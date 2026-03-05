import { prisma } from '../../config/database';
import { redis } from '../../config/redis';
import { logger } from '../../shared/utils/logger';
import { taskEventBus, statusToEvent, TaskEvent, TaskType, TaskEventPayload } from './taskEventBus';

/**
 * Records a status change in the audit trail and emits the appropriate event.
 * Call this whenever a task status changes across any of the 3 task models.
 */
export async function recordStatusChange(params: {
  taskId: string;
  taskType: TaskType;
  hotelId: string;
  fromStatus: string | null;
  toStatus: string;
  changedById?: string;
  changedByType?: 'staff' | 'guest' | 'system' | 'external';
  reason?: string;
}): Promise<void> {
  const {
    taskId, taskType, hotelId,
    fromStatus, toStatus,
    changedById, changedByType = 'system', reason,
  } = params;

  // 1. Record in audit trail
  try {
    await prisma.taskStatusChange.create({
      data: {
        taskId,
        taskType,
        fromStatus,
        toStatus,
        changedById,
        changedByType,
        reason,
      },
    });
  } catch (err) {
    logger.error({ err, taskId, taskType }, 'Failed to record status change');
  }

  // 2. Emit event via TaskEventBus
  const event = statusToEvent(toStatus);
  if (event) {
    const payload: TaskEventPayload = {
      taskId,
      taskType,
      hotelId,
      status: toStatus,
      previousStatus: fromStatus ?? undefined,
      changedBy: changedById ? { id: changedById, type: changedByType } : undefined,
      reason,
      timestamp: new Date(),
    };
    taskEventBus.emitTaskEvent(event, payload);
  }
}

/**
 * Publishes a task update to the staff SSE channel.
 * Extracted from inline Redis publishes so we can reuse it as an event bus listener.
 */
export function publishStaffTaskUpdate(hotelId: string, data: Record<string, unknown>): void {
  redis.publish(
    `staff_tasks:${hotelId}`,
    JSON.stringify({ type: 'task_update', ...data }),
  ).catch(() => {});
}

/**
 * Publishes a service request update to the dashboard SSE channel.
 */
export function publishServiceRequestUpdate(
  hotelId: string,
  type: string,
  data: Record<string, unknown>,
): void {
  redis.publish(
    `service_requests:${hotelId}`,
    JSON.stringify({ type, data }),
  ).catch(() => {});
}

/**
 * Publishes a guest-facing status update (for polling/SSE).
 */
export function publishGuestStatusUpdate(guestId: string, data: Record<string, unknown>): void {
  redis.publish(
    `service_request_status:${guestId}`,
    JSON.stringify(data),
  ).catch(() => {});
}

// ── Wire event bus to existing SSE channels + new channel-based SSE ──

function publishToChannels(p: TaskEventPayload) {
  const data = {
    taskId: p.taskId,
    taskType: p.taskType,
    status: p.status,
    previousStatus: p.previousStatus,
    timestamp: p.timestamp?.toISOString(),
    meta: p.meta,
  };

  // Legacy staff_tasks channel
  publishStaffTaskUpdate(p.hotelId, data);

  // New channel-based SSE: hotel:{hotelId}:tasks
  redis.publish(
    `hotel:${p.hotelId}:tasks`,
    JSON.stringify({ type: 'task_update', ...data }),
  ).catch(() => {});

  // If there's a specific staff assignee, publish to staff channel
  if (p.changedBy?.type === 'staff' && p.changedBy.id) {
    redis.publish(
      `staff:${p.changedBy.id}:tasks`,
      JSON.stringify({ type: 'task_update', ...data }),
    ).catch(() => {});
  }
}

// All task status events
const ALL_STATUS_EVENTS = [
  TaskEvent.TASK_CREATED, TaskEvent.TASK_ASSIGNED, TaskEvent.TASK_ACCEPTED,
  TaskEvent.TASK_IN_PROGRESS, TaskEvent.TASK_COMPLETED, TaskEvent.TASK_CANCELLED,
  TaskEvent.TASK_ESCALATED, TaskEvent.TASK_REASSIGNED,
];

for (const event of ALL_STATUS_EVENTS) {
  taskEventBus.onTaskEvent(event, publishToChannels);
}

// SLA events → hotel:{hotelId}:sla channel
taskEventBus.onTaskEvent(TaskEvent.TASK_SLA_WARNING, (p) => {
  redis.publish(
    `hotel:${p.hotelId}:sla`,
    JSON.stringify({ type: 'sla_warning', taskId: p.taskId, taskType: p.taskType, meta: p.meta }),
  ).catch(() => {});
  publishStaffTaskUpdate(p.hotelId, { type: 'SLA_ALERT', taskId: p.taskId, ...p.meta });
});

taskEventBus.onTaskEvent(TaskEvent.TASK_SLA_BREACHED, (p) => {
  redis.publish(
    `hotel:${p.hotelId}:sla`,
    JSON.stringify({ type: 'sla_breached', taskId: p.taskId, taskType: p.taskType, meta: p.meta }),
  ).catch(() => {});
  publishStaffTaskUpdate(p.hotelId, { type: 'SLA_ALERT', taskId: p.taskId, ...p.meta });
});

// ETA updates → guest channel
taskEventBus.onTaskEvent(TaskEvent.TASK_ETA_UPDATED, (p) => {
  redis.publish(
    `hotel:${p.hotelId}:tasks`,
    JSON.stringify({ type: 'eta_update', taskId: p.taskId, taskType: p.taskType, meta: p.meta }),
  ).catch(() => {});
});

// Rating events
taskEventBus.onTaskEvent(TaskEvent.TASK_RATED, (p) => {
  redis.publish(
    `hotel:${p.hotelId}:tasks`,
    JSON.stringify({ type: 'task_rated', taskId: p.taskId, taskType: p.taskType, meta: p.meta }),
  ).catch(() => {});
});

logger.info('TaskEventBus: SSE listeners wired (legacy + channel-based)');
