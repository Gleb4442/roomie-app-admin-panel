/**
 * Notification Service
 *
 * Subscribes to TaskEventBus and sends notifications per the notification matrix:
 *
 * | Event           | Guest Push | Staff Push | Supervisor Push | SSE |
 * |-----------------|------------|------------|-----------------|-----|
 * | task.assigned   | "Accepted" | "New task" | -               | Yes |
 * | task.in_progress| "On the way"| -        | -               | Yes |
 * | task.completed  | "Done!"    | -          | -               | Yes |
 * | task.sla_warning| -          | Yes        | Yes             | Yes |
 * | task.sla_breached| -         | Yes        | Yes             | Yes |
 * | task.escalated  | -          | Yes        | Yes             | Yes |
 * | task.eta_updated| "ETA: Xm"  | -         | -               | Yes |
 */

import { prisma } from '../../config/database';
import { taskEventBus, TaskEvent, TaskEventPayload } from './taskEventBus';
import { getSupervisorsOnShift, getStaffPushToken } from '../staff/staff.service';
import { logger } from '../../shared/utils/logger';

async function sendExpoPush(tokens: string[], title: string, body: string, data?: Record<string, unknown>) {
  const messages = tokens
    .filter(t => t.startsWith('ExponentPushToken[') || t.startsWith('ExpoPushToken['))
    .map(to => ({ to, title, body, sound: 'default' as const, priority: 'high' as const, data }));

  if (messages.length === 0) return;

  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(messages),
    });
  } catch (err) {
    logger.warn(err, '[Notifications] Push send failed');
  }
}

async function getGuestPushToken(taskId: string, taskType: string): Promise<{ token: string | null; guestId: string | null }> {
  let guestId: string | null = null;

  if (taskType === 'SERVICE_REQUEST') {
    const sr = await prisma.serviceRequest.findUnique({ where: { id: taskId }, select: { guestId: true } });
    guestId = sr?.guestId ?? null;
  } else if (taskType === 'ORDER') {
    const o = await prisma.order.findUnique({ where: { id: taskId }, select: { guestId: true } });
    guestId = o?.guestId ?? null;
  }

  if (!guestId) return { token: null, guestId: null };

  const guest = await prisma.guestAccount.findUnique({
    where: { id: guestId },
    select: { expoPushToken: true },
  });

  return { token: guest?.expoPushToken ?? null, guestId };
}

// ── Guest Notifications ──────────────────────────────────────

taskEventBus.on(TaskEvent.TASK_ASSIGNED, async (p: TaskEventPayload) => {
  if (p.taskType === 'INTERNAL') return; // No guest for internal tasks

  const { token } = await getGuestPushToken(p.taskId, p.taskType);
  if (token) {
    await sendExpoPush([token], 'Request Accepted', 'Your request has been accepted by staff.', {
      taskId: p.taskId, taskType: p.taskType, screen: 'orders',
    });
  }
});

taskEventBus.on(TaskEvent.TASK_IN_PROGRESS, async (p: TaskEventPayload) => {
  if (p.taskType === 'INTERNAL') return;

  const { token } = await getGuestPushToken(p.taskId, p.taskType);
  if (token) {
    await sendExpoPush([token], 'Staff on the way', 'Your request is being handled right now.', {
      taskId: p.taskId, taskType: p.taskType, screen: 'orders',
    });
  }
});

taskEventBus.on(TaskEvent.TASK_COMPLETED, async (p: TaskEventPayload) => {
  if (p.taskType === 'INTERNAL') return;

  const { token } = await getGuestPushToken(p.taskId, p.taskType);
  if (token) {
    await sendExpoPush([token], 'Done!', 'Your request has been completed. How was the service?', {
      taskId: p.taskId, taskType: p.taskType, screen: 'orders', action: 'rate',
    });
  }
});

taskEventBus.on(TaskEvent.TASK_ETA_UPDATED, async (p: TaskEventPayload) => {
  if (p.taskType === 'INTERNAL') return;

  const etaMinutes = (p.meta as any)?.etaMinutes;
  if (!etaMinutes) return;

  const { token } = await getGuestPushToken(p.taskId, p.taskType);
  if (token) {
    await sendExpoPush([token], 'Updated ETA', `Estimated time: ~${etaMinutes} minutes`, {
      taskId: p.taskId, taskType: p.taskType, screen: 'orders',
    });
  }
});

// ── Staff Notifications ──────────────────────────────────────

taskEventBus.on(TaskEvent.TASK_ASSIGNED, async (p: TaskEventPayload) => {
  // Notify assigned staff — find assignee from the task itself
  let staffId: string | null = null;

  if (p.taskType === 'INTERNAL') {
    const t = await prisma.internalTask.findUnique({ where: { id: p.taskId }, select: { assignedToId: true } });
    staffId = t?.assignedToId ?? null;
  } else if (p.taskType === 'SERVICE_REQUEST') {
    const sr = await prisma.serviceRequest.findUnique({ where: { id: p.taskId }, select: { assignedStaffId: true } });
    staffId = sr?.assignedStaffId ?? null;
  } else if (p.taskType === 'ORDER') {
    const o = await prisma.order.findUnique({ where: { id: p.taskId }, select: { assignedStaffId: true } });
    staffId = o?.assignedStaffId ?? null;
  }

  if (staffId) {
    const token = await getStaffPushToken(staffId);
    if (token) {
      await sendExpoPush([token], 'New Task Assigned', `You have a new ${p.taskType.toLowerCase().replace('_', ' ')} task.`, {
        taskId: p.taskId, taskType: p.taskType,
      });
    }
  }
});

// ── Supervisor Notifications ─────────────────────────────────

taskEventBus.on(TaskEvent.TASK_ESCALATED, async (p: TaskEventPayload) => {
  const tokens = await getSupervisorsOnShift(p.hotelId);
  if (tokens.length > 0) {
    const reason = (p.meta as any)?.reason || 'Task escalated';
    await sendExpoPush(tokens, 'Task Escalated', reason, {
      taskId: p.taskId, taskType: p.taskType,
    });
  }
});

taskEventBus.on(TaskEvent.TASK_SLA_BREACHED, async (p: TaskEventPayload) => {
  const tokens = await getSupervisorsOnShift(p.hotelId);
  if (tokens.length > 0) {
    await sendExpoPush(tokens, 'SLA Breached', `Task ${p.taskId.slice(0, 8)} has breached its SLA.`, {
      taskId: p.taskId, taskType: p.taskType,
    });
  }
});

logger.info('[NotificationService] Task event listeners registered');
