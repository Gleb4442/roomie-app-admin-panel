/**
 * Tests for etaCalculator.ts
 *
 * Mocks: prisma, taskEventBus
 */

// Mock prisma
const mockPrisma = {
  serviceCategory: { findUnique: jest.fn() },
  serviceRequest: { findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn(), count: jest.fn() },
  internalTask: { count: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
  order: { findUnique: jest.fn(), update: jest.fn(), count: jest.fn() },
};
jest.mock('../config/database', () => ({ prisma: mockPrisma }));

// Mock event bus
const mockEmit = jest.fn();
jest.mock('../modules/task/taskEventBus', () => ({
  taskEventBus: { emitTaskEvent: mockEmit },
  TaskEvent: { TASK_ETA_UPDATED: 'task.eta_updated' },
}));

import { estimateETA, recalculateAndUpdateETA } from '../modules/task/etaCalculator';

beforeEach(() => {
  jest.clearAllMocks();
  // Default: all counts return 0 (BUG-11 fix now counts all 3 task types)
  mockPrisma.internalTask.count.mockResolvedValue(0);
  mockPrisma.serviceRequest.count.mockResolvedValue(0);
  mockPrisma.order.count.mockResolvedValue(0);
});

describe('estimateETA', () => {
  it('должен вернуть default ETA (30 мин) когда нет категории и истории', async () => {
    mockPrisma.internalTask.count.mockResolvedValue(0);

    const eta = await estimateETA({ hotelId: 'hotel-1' });

    // 30 min * 1.0 (workload) * timeFactor * 1.0 (priority) → rounded to 5
    expect(eta).toBeGreaterThanOrEqual(5);
    expect(eta % 5).toBe(0);
  });

  it('должен использовать defaultEtaMinutes из категории', async () => {
    mockPrisma.serviceCategory.findUnique.mockResolvedValue({
      defaultEtaMinutes: 20,
      estimatedMinutes: null,
    });
    mockPrisma.serviceRequest.findMany.mockResolvedValue([]);
    mockPrisma.internalTask.count.mockResolvedValue(0);

    const eta = await estimateETA({
      hotelId: 'hotel-1',
      categoryId: 'cat-1',
    });

    // 20 min base * 1.0 * timeFactor * 1.0
    expect(eta).toBeGreaterThanOrEqual(5);
    expect(eta).toBeLessThanOrEqual(30); // max 20*1.2 = 24 → rounded to 25
  });

  it('должен использовать estimatedMinutes как fallback когда нет defaultEtaMinutes', async () => {
    mockPrisma.serviceCategory.findUnique.mockResolvedValue({
      defaultEtaMinutes: null,
      estimatedMinutes: 15,
    });
    mockPrisma.serviceRequest.findMany.mockResolvedValue([]);
    mockPrisma.internalTask.count.mockResolvedValue(0);

    const eta = await estimateETA({
      hotelId: 'hotel-1',
      categoryId: 'cat-1',
    });

    expect(eta).toBeGreaterThanOrEqual(5);
  });

  it('должен предпочитать историческое среднее когда >= 3 записей', async () => {
    mockPrisma.serviceCategory.findUnique.mockResolvedValue({
      defaultEtaMinutes: 60,
      estimatedMinutes: null,
    });

    const now = Date.now();
    // 3 tasks, each took 10 minutes
    mockPrisma.serviceRequest.findMany.mockResolvedValue([
      { createdAt: new Date(now - 600000), completedAt: new Date(now) },
      { createdAt: new Date(now - 600000), completedAt: new Date(now) },
      { createdAt: new Date(now - 600000), completedAt: new Date(now) },
    ]);
    mockPrisma.internalTask.count.mockResolvedValue(0);

    const eta = await estimateETA({
      hotelId: 'hotel-1',
      categoryId: 'cat-1',
    });

    // Historical avg = 10 min, should use that instead of category default 60
    expect(eta).toBeLessThan(60);
  });

  it('должен НЕ использовать историю когда < 3 записей', async () => {
    mockPrisma.serviceCategory.findUnique.mockResolvedValue({
      defaultEtaMinutes: 45,
      estimatedMinutes: null,
    });

    const now = Date.now();
    mockPrisma.serviceRequest.findMany.mockResolvedValue([
      { createdAt: new Date(now - 300000), completedAt: new Date(now) },
      { createdAt: new Date(now - 300000), completedAt: new Date(now) },
    ]);
    mockPrisma.internalTask.count.mockResolvedValue(0);

    const eta = await estimateETA({
      hotelId: 'hotel-1',
      categoryId: 'cat-1',
    });

    // Should use category default 45, not historical
    expect(eta).toBeGreaterThanOrEqual(40);
  });

  it('должен увеличить ETA при высокой нагрузке (>20 задач)', async () => {
    mockPrisma.serviceCategory.findUnique.mockResolvedValue(null);
    mockPrisma.serviceRequest.findMany.mockResolvedValue([]);
    mockPrisma.internalTask.count.mockResolvedValue(15);
    mockPrisma.serviceRequest.count.mockResolvedValue(5);
    mockPrisma.order.count.mockResolvedValue(5);

    const eta = await estimateETA({ hotelId: 'hotel-1', categoryId: 'cat-1' });

    // 30 * 1.3 = 39 * timeFactor → ≥35
    expect(eta).toBeGreaterThanOrEqual(35);
  });

  it('должен применять коэффициент приоритета URGENT (0.6x)', async () => {
    mockPrisma.internalTask.count.mockResolvedValue(0);

    const etaNormal = await estimateETA({ hotelId: 'hotel-1', priority: 'NORMAL' });
    const etaUrgent = await estimateETA({ hotelId: 'hotel-1', priority: 'URGENT' });

    expect(etaUrgent).toBeLessThanOrEqual(etaNormal);
  });

  it('должен применять коэффициент приоритета LOW (1.2x)', async () => {
    mockPrisma.internalTask.count.mockResolvedValue(0);

    const etaNormal = await estimateETA({ hotelId: 'hotel-1', priority: 'NORMAL' });
    const etaLow = await estimateETA({ hotelId: 'hotel-1', priority: 'LOW' });

    expect(etaLow).toBeGreaterThanOrEqual(etaNormal);
  });

  it('должен вернуть минимум 5 минут', async () => {
    mockPrisma.serviceCategory.findUnique.mockResolvedValue({
      defaultEtaMinutes: 1,
      estimatedMinutes: null,
    });
    mockPrisma.serviceRequest.findMany.mockResolvedValue([]);
    mockPrisma.internalTask.count.mockResolvedValue(0);

    const eta = await estimateETA({
      hotelId: 'hotel-1',
      categoryId: 'cat-1',
      priority: 'URGENT',
    });

    expect(eta).toBeGreaterThanOrEqual(5);
  });

  it('должен округлять до 5 минут', async () => {
    mockPrisma.internalTask.count.mockResolvedValue(0);

    const eta = await estimateETA({ hotelId: 'hotel-1' });

    expect(eta % 5).toBe(0);
  });
});

describe('recalculateAndUpdateETA', () => {
  it('должен обновить ETA для SERVICE_REQUEST и emit событие', async () => {
    mockPrisma.serviceRequest.findUnique.mockResolvedValue({
      categoryId: 'cat-1',
      priority: 'NORMAL',
    });
    mockPrisma.serviceCategory.findUnique.mockResolvedValue({
      defaultEtaMinutes: 20,
      estimatedMinutes: null,
    });
    mockPrisma.serviceRequest.findMany.mockResolvedValue([]);
    mockPrisma.internalTask.count.mockResolvedValue(0);
    mockPrisma.serviceRequest.update.mockResolvedValue({});

    const eta = await recalculateAndUpdateETA('task-1', 'SERVICE_REQUEST', 'hotel-1');

    expect(eta).not.toBeNull();
    expect(eta! % 5).toBe(0);
    expect(mockPrisma.serviceRequest.update).toHaveBeenCalledWith({
      where: { id: 'task-1' },
      data: { etaMinutes: eta, etaUpdatedAt: expect.any(Date) },
    });
    expect(mockEmit).toHaveBeenCalledWith('task.eta_updated', expect.objectContaining({
      taskId: 'task-1',
      taskType: 'SERVICE_REQUEST',
      meta: { etaMinutes: eta },
    }));
  });

  it('должен вернуть null когда задача не найдена', async () => {
    mockPrisma.serviceRequest.findUnique.mockResolvedValue(null);

    const eta = await recalculateAndUpdateETA('nonexistent', 'SERVICE_REQUEST', 'hotel-1');

    expect(eta).toBeNull();
    expect(mockEmit).not.toHaveBeenCalled();
  });

  it('должен обновить ETA для INTERNAL task', async () => {
    mockPrisma.internalTask.findUnique.mockResolvedValue({ priority: 'HIGH' });
    mockPrisma.internalTask.count.mockResolvedValue(5);
    mockPrisma.internalTask.update.mockResolvedValue({});

    const eta = await recalculateAndUpdateETA('task-2', 'INTERNAL', 'hotel-1');

    expect(eta).not.toBeNull();
    expect(mockPrisma.internalTask.update).toHaveBeenCalled();
  });

  it('должен обновить ETA для ORDER', async () => {
    mockPrisma.order.findUnique.mockResolvedValue({ priority: 'NORMAL' });
    mockPrisma.internalTask.count.mockResolvedValue(0);
    mockPrisma.order.update.mockResolvedValue({});

    const eta = await recalculateAndUpdateETA('task-3', 'ORDER', 'hotel-1');

    expect(eta).not.toBeNull();
    expect(mockPrisma.order.update).toHaveBeenCalled();
  });
});
