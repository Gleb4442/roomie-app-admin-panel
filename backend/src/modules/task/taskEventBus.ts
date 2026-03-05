import { EventEmitter } from 'events';
import { logger } from '../../shared/utils/logger';

// ── Task Event Types ────────────────────────────────────────

export enum TaskEvent {
  TASK_CREATED = 'task.created',
  TASK_ASSIGNED = 'task.assigned',
  TASK_ACCEPTED = 'task.accepted',
  TASK_IN_PROGRESS = 'task.in_progress',
  TASK_COMPLETED = 'task.completed',
  TASK_CANCELLED = 'task.cancelled',
  TASK_ESCALATED = 'task.escalated',
  TASK_REASSIGNED = 'task.reassigned',
  TASK_RATED = 'task.rated',
  TASK_ETA_UPDATED = 'task.eta_updated',
  TASK_NOTE_ADDED = 'task.note_added',
  TASK_SLA_WARNING = 'task.sla_warning',
  TASK_SLA_BREACHED = 'task.sla_breached',
}

export type TaskType = 'INTERNAL' | 'ORDER' | 'SERVICE_REQUEST';

export interface TaskEventPayload {
  taskId: string;
  taskType: TaskType;
  hotelId: string;
  status: string;
  previousStatus?: string;
  changedBy?: {
    id: string;
    type: 'staff' | 'guest' | 'system' | 'external';
  };
  reason?: string;
  timestamp: Date;
  meta?: Record<string, unknown>;
}

// ── Event Bus Singleton ─────────────────────────────────────

class TaskEventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(30);
  }

  emitTaskEvent(event: TaskEvent, payload: TaskEventPayload): void {
    logger.debug({ event, taskId: payload.taskId, taskType: payload.taskType }, 'TaskEventBus: emitting event');
    this.emit(event, payload);
  }

  onTaskEvent(event: TaskEvent, handler: (payload: TaskEventPayload) => void | Promise<void>): void {
    this.on(event, async (payload: TaskEventPayload) => {
      try {
        await handler(payload);
      } catch (err) {
        logger.error({ err, event, taskId: payload.taskId }, 'TaskEventBus: handler error');
      }
    });
  }
}

export const taskEventBus = new TaskEventBus();

// ── Helper: Map status to event ─────────────────────────────

const STATUS_TO_EVENT: Record<string, TaskEvent> = {
  // InternalTask statuses
  NEW: TaskEvent.TASK_CREATED,
  ASSIGNED: TaskEvent.TASK_ASSIGNED,
  ACCEPTED: TaskEvent.TASK_ACCEPTED,
  IN_PROGRESS: TaskEvent.TASK_IN_PROGRESS,
  COMPLETED: TaskEvent.TASK_COMPLETED,
  CANCELLED: TaskEvent.TASK_CANCELLED,
  ESCALATED: TaskEvent.TASK_ESCALATED,
  ON_HOLD: TaskEvent.TASK_IN_PROGRESS, // ON_HOLD is a sub-state, no separate event yet
  INSPECTED: TaskEvent.TASK_COMPLETED,
  CLOSED: TaskEvent.TASK_COMPLETED,
  // ServiceRequest statuses (lowercase)
  pending: TaskEvent.TASK_CREATED,
  accepted: TaskEvent.TASK_ASSIGNED,
  confirmed: TaskEvent.TASK_ASSIGNED,
  in_progress: TaskEvent.TASK_IN_PROGRESS,
  completed: TaskEvent.TASK_COMPLETED,
  done: TaskEvent.TASK_COMPLETED,
  cancelled: TaskEvent.TASK_CANCELLED,
  rejected: TaskEvent.TASK_CANCELLED,
  // Order statuses
  PENDING: TaskEvent.TASK_CREATED,
  CONFIRMED: TaskEvent.TASK_ASSIGNED,
  PREPARING: TaskEvent.TASK_IN_PROGRESS,
  READY: TaskEvent.TASK_IN_PROGRESS,
  IN_TRANSIT: TaskEvent.TASK_IN_PROGRESS,
  DELIVERED: TaskEvent.TASK_COMPLETED,
};

export function statusToEvent(status: string): TaskEvent | null {
  return STATUS_TO_EVENT[status] ?? null;
}
