/**
 * Tests for escalationService.ts
 */

// Mock prisma
const mockPrisma = {
  internalTask: { findUnique: jest.fn(), update: jest.fn() },
  serviceRequest: { findUnique: jest.fn(), update: jest.fn() },
  order: { findUnique: jest.fn(), update: jest.fn() },
  hotelTMSConfig: { findUnique: jest.fn() },
};
jest.mock('../config/database', () => ({ prisma: mockPrisma }));

// Mock event bus
const mockEmit = jest.fn();
jest.mock('../modules/task/taskEventBus', () => ({
  taskEventBus: { emitTaskEvent: mockEmit },
  TaskEvent: { TASK_ESCALATED: 'task.escalated' },
}));

// Mock recordStatusChange
const mockRecordStatusChange = jest.fn().mockResolvedValue(undefined);
jest.mock('../modules/task/taskStatusTracker', () => ({
  recordStatusChange: (...args: any[]) => mockRecordStatusChange(...args),
}));

import { escalateTask, handleAutoEscalation } from '../modules/task/escalationService';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('escalateTask', () => {
  it('должен увеличить escalationLevel с 0 до 1 для INTERNAL', async () => {
    mockPrisma.internalTask.findUnique.mockResolvedValue({
      escalationLevel: 0,
      hotelId: 'hotel-1',
    });
    mockPrisma.hotelTMSConfig.findUnique.mockResolvedValue(null);
    mockPrisma.internalTask.update.mockResolvedValue({});

    const result = await escalateTask({
      taskId: 'task-1',
      taskType: 'INTERNAL',
      reason: 'Too slow',
      source: 'staff',
      triggeredById: 'staff-1',
    });

    expect(result.newLevel).toBe(1);
    expect(result.targetRole).toBe('SUPERVISOR');
    expect(mockPrisma.internalTask.update).toHaveBeenCalledWith({
      where: { id: 'task-1' },
      data: { escalationLevel: 1 },
    });
  });

  it('должен использовать custom escalation chain из HotelTMSConfig', async () => {
    mockPrisma.serviceRequest.findUnique.mockResolvedValue({
      escalationLevel: 1,
      hotelId: 'hotel-2',
    });
    mockPrisma.hotelTMSConfig.findUnique.mockResolvedValue({
      escalationChain: [
        { level: 1, targetRole: 'DUTY_MANAGER' },
        { level: 2, targetRole: 'GM' },
        { level: 3, targetRole: 'OWNER' },
      ],
    });
    mockPrisma.serviceRequest.update.mockResolvedValue({});

    const result = await escalateTask({
      taskId: 'sr-1',
      taskType: 'SERVICE_REQUEST',
      reason: 'SLA breach',
      source: 'system',
    });

    expect(result.newLevel).toBe(2);
    expect(result.targetRole).toBe('GM');
  });

  it('должен fallback на GENERAL_MANAGER когда level превышает chain', async () => {
    mockPrisma.order.findUnique.mockResolvedValue({
      escalationLevel: 5,
      hotelId: 'hotel-1',
    });
    mockPrisma.hotelTMSConfig.findUnique.mockResolvedValue(null);
    mockPrisma.order.update.mockResolvedValue({});

    const result = await escalateTask({
      taskId: 'order-1',
      taskType: 'ORDER',
      reason: 'Critical',
      source: 'staff',
    });

    expect(result.newLevel).toBe(6);
    expect(result.targetRole).toBe('GENERAL_MANAGER');
  });

  it('должен бросить ошибку когда задача не найдена', async () => {
    mockPrisma.internalTask.findUnique.mockResolvedValue(null);

    await expect(
      escalateTask({
        taskId: 'nonexistent',
        taskType: 'INTERNAL',
        reason: 'Test',
        source: 'staff',
      }),
    ).rejects.toThrow('TASK_NOT_FOUND');
  });

  it('должен записать audit trail через recordStatusChange', async () => {
    mockPrisma.internalTask.findUnique.mockResolvedValue({
      escalationLevel: 0,
      hotelId: 'hotel-1',
    });
    mockPrisma.hotelTMSConfig.findUnique.mockResolvedValue(null);
    mockPrisma.internalTask.update.mockResolvedValue({});

    await escalateTask({
      taskId: 'task-1',
      taskType: 'INTERNAL',
      reason: 'Test reason',
      source: 'staff',
      triggeredById: 'staff-1',
    });

    expect(mockRecordStatusChange).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: 'task-1',
        taskType: 'INTERNAL',
        fromStatus: 'escalation_level_0',
        toStatus: 'escalation_level_1',
        changedById: 'staff-1',
        changedByType: 'staff',
      }),
    );
  });

  it('должен emit TASK_ESCALATED событие', async () => {
    mockPrisma.serviceRequest.findUnique.mockResolvedValue({
      escalationLevel: 0,
      hotelId: 'hotel-1',
    });
    mockPrisma.hotelTMSConfig.findUnique.mockResolvedValue(null);
    mockPrisma.serviceRequest.update.mockResolvedValue({});

    await escalateTask({
      taskId: 'sr-1',
      taskType: 'SERVICE_REQUEST',
      reason: 'Guest complaint',
      source: 'staff',
      triggeredById: 'staff-2',
    });

    expect(mockEmit).toHaveBeenCalledWith(
      'task.escalated',
      expect.objectContaining({
        taskId: 'sr-1',
        taskType: 'SERVICE_REQUEST',
        hotelId: 'hotel-1',
        status: 'ESCALATED',
        meta: expect.objectContaining({
          newLevel: 1,
          targetRole: 'SUPERVISOR',
          reason: 'Guest complaint',
        }),
      }),
    );
  });
});

describe('handleAutoEscalation', () => {
  it('должен вызвать escalateTask с source=system', async () => {
    mockPrisma.internalTask.findUnique.mockResolvedValue({
      escalationLevel: 0,
      hotelId: 'hotel-1',
    });
    mockPrisma.hotelTMSConfig.findUnique.mockResolvedValue(null);
    mockPrisma.internalTask.update.mockResolvedValue({});

    const result = await handleAutoEscalation('task-1', 'INTERNAL');

    expect(result.newLevel).toBe(1);
    expect(mockEmit).toHaveBeenCalledWith(
      'task.escalated',
      expect.objectContaining({
        changedBy: undefined, // system doesn't have triggeredById
      }),
    );
  });
});
