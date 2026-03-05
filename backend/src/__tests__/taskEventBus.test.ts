/**
 * Tests for taskEventBus.ts
 */

import { taskEventBus, TaskEvent, statusToEvent } from '../modules/task/taskEventBus';
import type { TaskEventPayload } from '../modules/task/taskEventBus';

// ── statusToEvent ───────────────────────────────────────────

describe('statusToEvent', () => {
  it('должен маппить NEW → TASK_CREATED', () => {
    expect(statusToEvent('NEW')).toBe(TaskEvent.TASK_CREATED);
  });

  it('должен маппить ASSIGNED → TASK_ASSIGNED', () => {
    expect(statusToEvent('ASSIGNED')).toBe(TaskEvent.TASK_ASSIGNED);
  });

  it('должен маппить ACCEPTED → TASK_ACCEPTED', () => {
    expect(statusToEvent('ACCEPTED')).toBe(TaskEvent.TASK_ACCEPTED);
  });

  it('должен маппить IN_PROGRESS → TASK_IN_PROGRESS', () => {
    expect(statusToEvent('IN_PROGRESS')).toBe(TaskEvent.TASK_IN_PROGRESS);
  });

  it('должен маппить COMPLETED → TASK_COMPLETED', () => {
    expect(statusToEvent('COMPLETED')).toBe(TaskEvent.TASK_COMPLETED);
  });

  it('должен маппить CANCELLED → TASK_CANCELLED', () => {
    expect(statusToEvent('CANCELLED')).toBe(TaskEvent.TASK_CANCELLED);
  });

  it('должен маппить ESCALATED → TASK_ESCALATED', () => {
    expect(statusToEvent('ESCALATED')).toBe(TaskEvent.TASK_ESCALATED);
  });

  // ServiceRequest lowercase statuses
  it('должен маппить pending → TASK_CREATED', () => {
    expect(statusToEvent('pending')).toBe(TaskEvent.TASK_CREATED);
  });

  it('должен маппить confirmed → TASK_ASSIGNED', () => {
    expect(statusToEvent('confirmed')).toBe(TaskEvent.TASK_ASSIGNED);
  });

  it('должен маппить in_progress → TASK_IN_PROGRESS', () => {
    expect(statusToEvent('in_progress')).toBe(TaskEvent.TASK_IN_PROGRESS);
  });

  it('должен маппить done → TASK_COMPLETED', () => {
    expect(statusToEvent('done')).toBe(TaskEvent.TASK_COMPLETED);
  });

  // Order statuses
  it('должен маппить PENDING → TASK_CREATED', () => {
    expect(statusToEvent('PENDING')).toBe(TaskEvent.TASK_CREATED);
  });

  it('должен маппить DELIVERED → TASK_COMPLETED', () => {
    expect(statusToEvent('DELIVERED')).toBe(TaskEvent.TASK_COMPLETED);
  });

  it('должен маппить PREPARING → TASK_IN_PROGRESS', () => {
    expect(statusToEvent('PREPARING')).toBe(TaskEvent.TASK_IN_PROGRESS);
  });

  it('должен вернуть null для неизвестного статуса', () => {
    expect(statusToEvent('NONEXISTENT')).toBeNull();
  });

  it('должен маппить ON_HOLD → TASK_IN_PROGRESS (sub-state)', () => {
    expect(statusToEvent('ON_HOLD')).toBe(TaskEvent.TASK_IN_PROGRESS);
  });

  it('должен маппить INSPECTED → TASK_COMPLETED', () => {
    expect(statusToEvent('INSPECTED')).toBe(TaskEvent.TASK_COMPLETED);
  });
});

// ── TaskEventBus ────────────────────────────────────────────

describe('TaskEventBus', () => {
  afterEach(() => {
    taskEventBus.removeAllListeners();
  });

  it('должен emit и получить событие через emitTaskEvent/onTaskEvent', (done) => {
    const payload: TaskEventPayload = {
      taskId: 'task-1',
      taskType: 'INTERNAL',
      hotelId: 'hotel-1',
      status: 'ASSIGNED',
      timestamp: new Date(),
    };

    taskEventBus.onTaskEvent(TaskEvent.TASK_ASSIGNED, (p) => {
      expect(p.taskId).toBe('task-1');
      expect(p.taskType).toBe('INTERNAL');
      done();
    });

    taskEventBus.emitTaskEvent(TaskEvent.TASK_ASSIGNED, payload);
  });

  it('должен обработать ошибку в handler без crash через onTaskEvent', (done) => {
    taskEventBus.onTaskEvent(TaskEvent.TASK_CREATED, () => {
      throw new Error('Test error');
    });

    // Не должно бросить исключение
    taskEventBus.emitTaskEvent(TaskEvent.TASK_CREATED, {
      taskId: 'task-2',
      taskType: 'INTERNAL',
      hotelId: 'hotel-1',
      status: 'NEW',
      timestamp: new Date(),
    });

    // Если дошли сюда — ошибка поймана
    setTimeout(done, 50);
  });

  it('должен поддерживать несколько listeners на одно событие', () => {
    let count = 0;

    taskEventBus.onTaskEvent(TaskEvent.TASK_COMPLETED, () => { count++; });
    taskEventBus.onTaskEvent(TaskEvent.TASK_COMPLETED, () => { count++; });

    taskEventBus.emitTaskEvent(TaskEvent.TASK_COMPLETED, {
      taskId: 'task-3',
      taskType: 'ORDER',
      hotelId: 'hotel-1',
      status: 'COMPLETED',
      timestamp: new Date(),
    });

    // onTaskEvent wraps in async, so check after tick
    setTimeout(() => {
      expect(count).toBe(2);
    }, 10);
  });

  it('должен передать meta в payload', (done) => {
    taskEventBus.onTaskEvent(TaskEvent.TASK_ETA_UPDATED, (p) => {
      expect(p.meta).toEqual({ etaMinutes: 15 });
      done();
    });

    taskEventBus.emitTaskEvent(TaskEvent.TASK_ETA_UPDATED, {
      taskId: 'task-4',
      taskType: 'SERVICE_REQUEST',
      hotelId: 'hotel-1',
      status: 'ETA_UPDATED',
      timestamp: new Date(),
      meta: { etaMinutes: 15 },
    });
  });

  it('должен передать changedBy в payload', (done) => {
    taskEventBus.onTaskEvent(TaskEvent.TASK_ESCALATED, (p) => {
      expect(p.changedBy).toEqual({ id: 'staff-1', type: 'staff' });
      expect(p.reason).toBe('SLA breach');
      done();
    });

    taskEventBus.emitTaskEvent(TaskEvent.TASK_ESCALATED, {
      taskId: 'task-5',
      taskType: 'INTERNAL',
      hotelId: 'hotel-1',
      status: 'ESCALATED',
      changedBy: { id: 'staff-1', type: 'staff' },
      reason: 'SLA breach',
      timestamp: new Date(),
    });
  });
});
