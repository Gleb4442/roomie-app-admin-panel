/**
 * Tests for unifiedTask.service.ts
 */

// Mock prisma
const mockPrisma = {
  internalTask: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  serviceRequest: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  order: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  taskStatusChange: { findMany: jest.fn() },
  taskNote: { findMany: jest.fn(), create: jest.fn() },
  taskPhoto: { findMany: jest.fn(), create: jest.fn() },
  taskComment: { findMany: jest.fn() },
  guestAccount: { findUnique: jest.fn() },
};
jest.mock('../config/database', () => ({ prisma: mockPrisma }));

// Mock event bus
const mockEmit = jest.fn();
jest.mock('../modules/task/taskEventBus', () => ({
  taskEventBus: { emitTaskEvent: mockEmit },
  TaskEvent: {
    TASK_RATED: 'task.rated',
    TASK_NOTE_ADDED: 'task.note_added',
  },
}));

import {
  getTaskDetail,
  rateTask,
  addNote,
  getTaskNotes,
  addPhoto,
  getTaskPhotos,
  getStatusHistory,
  getGuestTasks,
  getHotelTasks,
} from '../modules/task/unifiedTask.service';

beforeEach(() => {
  jest.clearAllMocks();
});

// ── getTaskDetail ───────────────────────────────────────────

describe('getTaskDetail', () => {
  it('должен вернуть INTERNAL task с историей и заметками', async () => {
    const task = { id: 'task-1', hotelId: 'hotel-1', title: 'Clean room' };
    mockPrisma.internalTask.findUnique.mockResolvedValue(task);
    mockPrisma.taskStatusChange.findMany.mockResolvedValue([{ id: 'sc-1', toStatus: 'NEW' }]);
    mockPrisma.taskNote.findMany.mockResolvedValue([]);
    mockPrisma.taskPhoto.findMany.mockResolvedValue([]);
    mockPrisma.taskComment.findMany.mockResolvedValue([]);

    const result = await getTaskDetail('task-1', 'INTERNAL');

    expect(result).not.toBeNull();
    expect(result!.task.id).toBe('task-1');
    expect(result!.statusHistory).toHaveLength(1);
    expect(result!.notes).toHaveLength(0);
  });

  it('должен вернуть SERVICE_REQUEST task', async () => {
    mockPrisma.serviceRequest.findUnique.mockResolvedValue({
      id: 'sr-1', hotelId: 'hotel-1',
    });
    mockPrisma.taskStatusChange.findMany.mockResolvedValue([]);
    mockPrisma.taskNote.findMany.mockResolvedValue([]);
    mockPrisma.taskPhoto.findMany.mockResolvedValue([]);
    mockPrisma.taskComment.findMany.mockResolvedValue([]);

    const result = await getTaskDetail('sr-1', 'SERVICE_REQUEST');

    expect(result).not.toBeNull();
    expect(result!.task.id).toBe('sr-1');
  });

  it('должен вернуть ORDER task', async () => {
    mockPrisma.order.findUnique.mockResolvedValue({
      id: 'ord-1', hotelId: 'hotel-1',
    });
    mockPrisma.taskStatusChange.findMany.mockResolvedValue([]);
    mockPrisma.taskNote.findMany.mockResolvedValue([]);
    mockPrisma.taskPhoto.findMany.mockResolvedValue([]);
    mockPrisma.taskComment.findMany.mockResolvedValue([]);

    const result = await getTaskDetail('ord-1', 'ORDER');

    expect(result).not.toBeNull();
  });

  it('должен вернуть null когда задача не найдена', async () => {
    mockPrisma.internalTask.findUnique.mockResolvedValue(null);

    const result = await getTaskDetail('nonexistent', 'INTERNAL');

    expect(result).toBeNull();
  });
});

// ── rateTask ────────────────────────────────────────────────

describe('rateTask', () => {
  it('должен обновить rating для SERVICE_REQUEST', async () => {
    mockPrisma.serviceRequest.update.mockResolvedValue({ hotelId: 'hotel-1' });

    const result = await rateTask('sr-1', 'SERVICE_REQUEST', 'guest-1', 5, 'Great!');

    expect(result.success).toBe(true);
    expect(result.rating).toBe(5);
    expect(mockPrisma.serviceRequest.update).toHaveBeenCalledWith({
      where: { id: 'sr-1' },
      data: {
        rating: 5,
        ratingComment: 'Great!',
        ratedAt: expect.any(Date),
      },
      select: { hotelId: true },
    });
  });

  it('должен emit TASK_RATED событие', async () => {
    mockPrisma.order.update.mockResolvedValue({ hotelId: 'hotel-2' });

    await rateTask('ord-1', 'ORDER', 'guest-1', 4);

    expect(mockEmit).toHaveBeenCalledWith(
      'task.rated',
      expect.objectContaining({
        taskId: 'ord-1',
        taskType: 'ORDER',
        hotelId: 'hotel-2',
        meta: { rating: 4, comment: undefined },
      }),
    );
  });

  it('должен бросить ошибку при rating < 1', async () => {
    await expect(
      rateTask('sr-1', 'SERVICE_REQUEST', 'guest-1', 0),
    ).rejects.toThrow('INVALID_RATING');
  });

  it('должен бросить ошибку при rating > 5', async () => {
    await expect(
      rateTask('sr-1', 'SERVICE_REQUEST', 'guest-1', 6),
    ).rejects.toThrow('INVALID_RATING');
  });

  it('должен сохранить null в ratingComment когда комментарий не передан', async () => {
    mockPrisma.internalTask.update.mockResolvedValue({ hotelId: 'hotel-1' });

    await rateTask('task-1', 'INTERNAL', 'guest-1', 3);

    expect(mockPrisma.internalTask.update).toHaveBeenCalledWith({
      where: { id: 'task-1' },
      data: expect.objectContaining({ ratingComment: null }),
      select: { hotelId: true },
    });
  });
});

// ── addNote ─────────────────────────────────────────────────

describe('addNote', () => {
  it('должен создать заметку и emit событие', async () => {
    const note = { id: 'note-1', taskId: 'task-1', content: 'Test note' };
    mockPrisma.taskNote.create.mockResolvedValue(note);
    mockPrisma.internalTask.findUnique.mockResolvedValue({ hotelId: 'hotel-1' });

    const result = await addNote('task-1', 'INTERNAL', 'staff-1', 'staff', 'Test note', false);

    expect(result).toEqual(note);
    expect(mockPrisma.taskNote.create).toHaveBeenCalledWith({
      data: {
        taskId: 'task-1',
        taskType: 'INTERNAL',
        authorId: 'staff-1',
        authorType: 'staff',
        content: 'Test note',
        isInternal: false,
      },
    });
    expect(mockEmit).toHaveBeenCalledWith(
      'task.note_added',
      expect.objectContaining({
        taskId: 'task-1',
        meta: { noteId: 'note-1', isInternal: false },
      }),
    );
  });

  it('должен создать internal заметку', async () => {
    mockPrisma.taskNote.create.mockResolvedValue({ id: 'note-2' });
    mockPrisma.internalTask.findUnique.mockResolvedValue({ hotelId: 'hotel-1' });

    await addNote('task-1', 'INTERNAL', 'staff-1', 'staff', 'Secret', true);

    expect(mockPrisma.taskNote.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ isInternal: true }),
    });
  });
});

// ── getTaskNotes ────────────────────────────────────────────

describe('getTaskNotes', () => {
  it('должен вернуть все заметки включая internal', async () => {
    mockPrisma.taskNote.findMany.mockResolvedValue([
      { id: '1', isInternal: false },
      { id: '2', isInternal: true },
    ]);

    const notes = await getTaskNotes('task-1', 'INTERNAL', true);

    expect(notes).toHaveLength(2);
  });

  it('должен фильтровать internal заметки когда includeInternal=false', async () => {
    mockPrisma.taskNote.findMany.mockResolvedValue([
      { id: '1', isInternal: false },
    ]);

    await getTaskNotes('task-1', 'INTERNAL', false);

    expect(mockPrisma.taskNote.findMany).toHaveBeenCalledWith({
      where: {
        taskId: 'task-1',
        taskType: 'INTERNAL',
        isInternal: false,
      },
      orderBy: { createdAt: 'asc' },
    });
  });
});

// ── getGuestTasks ───────────────────────────────────────────

describe('getGuestTasks', () => {
  it('должен вернуть SERVICE_REQUEST и ORDER отсортированные по дате', async () => {
    const now = Date.now();
    mockPrisma.serviceRequest.findMany.mockResolvedValue([
      {
        id: 'sr-1',
        status: 'pending',
        priority: 'NORMAL',
        roomNumber: '305',
        etaMinutes: 15,
        rating: null,
        ratingComment: null,
        ratedAt: null,
        slaBreached: false,
        escalationLevel: 0,
        createdAt: new Date(now - 1000),
        updatedAt: new Date(now),
        completedAt: null,
        acceptedAt: null,
        startedAt: null,
        category: { name: 'Room Service', slug: 'room_service', icon: null },
        items: [{ quantity: 1, serviceItem: { name: 'Towels' } }],
      },
    ]);
    mockPrisma.order.findMany.mockResolvedValue([
      {
        id: 'ord-1',
        status: 'CONFIRMED',
        priority: 'NORMAL',
        roomNumber: '305',
        etaMinutes: 20,
        rating: 5,
        ratingComment: 'Nice',
        ratedAt: new Date(),
        slaBreached: false,
        escalationLevel: 0,
        createdAt: new Date(now),
        updatedAt: new Date(now),
        deliveredAt: null,
        orderNumber: 1001,
        items: [{ quantity: 2, service: { name: 'Pizza' } }],
      },
    ]);

    const tasks = await getGuestTasks('guest-1', 'hotel-1');

    expect(tasks).toHaveLength(2);
    // Order has newer createdAt, so it should come first
    expect(tasks[0].taskType).toBe('ORDER');
    expect(tasks[1].taskType).toBe('SERVICE_REQUEST');
  });

  it('должен работать без hotelId (все отели)', async () => {
    mockPrisma.serviceRequest.findMany.mockResolvedValue([]);
    mockPrisma.order.findMany.mockResolvedValue([]);

    const tasks = await getGuestTasks('guest-1');

    expect(tasks).toEqual([]);
    // Should NOT include hotelId in filter
    expect(mockPrisma.serviceRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { guestId: 'guest-1' },
      }),
    );
  });
});

// ── getHotelTasks ───────────────────────────────────────────

describe('getHotelTasks', () => {
  it('должен вернуть все 3 типа задач по умолчанию', async () => {
    mockPrisma.internalTask.findMany.mockResolvedValue([
      { id: 't-1', createdAt: new Date() },
    ]);
    mockPrisma.serviceRequest.findMany.mockResolvedValue([
      { id: 'sr-1', createdAt: new Date() },
    ]);
    mockPrisma.order.findMany.mockResolvedValue([
      { id: 'o-1', createdAt: new Date() },
    ]);

    const tasks = await getHotelTasks('hotel-1');

    expect(tasks).toHaveLength(3);
  });

  it('должен фильтровать по taskType', async () => {
    mockPrisma.internalTask.findMany.mockResolvedValue([
      { id: 't-1', createdAt: new Date() },
    ]);

    const tasks = await getHotelTasks('hotel-1', { taskType: 'INTERNAL' });

    expect(mockPrisma.serviceRequest.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.order.findMany).not.toHaveBeenCalled();
  });

  it('должен фильтровать по status', async () => {
    mockPrisma.internalTask.findMany.mockResolvedValue([]);
    mockPrisma.serviceRequest.findMany.mockResolvedValue([]);
    mockPrisma.order.findMany.mockResolvedValue([]);

    await getHotelTasks('hotel-1', { status: ['IN_PROGRESS', 'ASSIGNED'] });

    expect(mockPrisma.internalTask.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ['IN_PROGRESS', 'ASSIGNED'] },
        }),
      }),
    );
  });

  it('должен фильтровать по slaBreached', async () => {
    mockPrisma.internalTask.findMany.mockResolvedValue([]);
    mockPrisma.serviceRequest.findMany.mockResolvedValue([]);
    mockPrisma.order.findMany.mockResolvedValue([]);

    await getHotelTasks('hotel-1', { slaBreached: true });

    expect(mockPrisma.internalTask.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          slaBreached: true,
        }),
      }),
    );
  });

  it('должен ограничить результат по limit', async () => {
    const many = Array.from({ length: 30 }, (_, i) => ({
      id: `t-${i}`,
      createdAt: new Date(Date.now() - i * 1000),
    }));
    mockPrisma.internalTask.findMany.mockResolvedValue(many);
    mockPrisma.serviceRequest.findMany.mockResolvedValue([]);
    mockPrisma.order.findMany.mockResolvedValue([]);

    const tasks = await getHotelTasks('hotel-1', { limit: 10 });

    expect(tasks.length).toBeLessThanOrEqual(10);
  });
});
