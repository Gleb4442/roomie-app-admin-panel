import cron from 'node-cron';
import { prisma } from '../config/database';
import { redis } from '../config/redis';
import { logger } from '../shared/utils/logger';
import { getSupervisorsOnShift, getStaffPushToken } from '../modules/staff/staff.service';
import { taskEventBus, TaskEvent } from '../modules/task/taskEventBus';
import type { TaskType } from '../modules/task/taskEventBus';
import { handleAutoEscalation } from '../modules/task/escalationService';
import { recalculateAndUpdateETA } from '../modules/task/etaCalculator';

// SLA thresholds (percentage of slaMinutes elapsed)
const THRESHOLDS = [
  { pct: 75,  label: 'warning',  emoji: '⚠️', event: TaskEvent.TASK_SLA_WARNING },
  { pct: 100, label: 'overdue',  emoji: '🔴', event: TaskEvent.TASK_SLA_BREACHED },
  { pct: 150, label: 'critical', emoji: '🚨', event: TaskEvent.TASK_SLA_BREACHED },
];

// Send push notification via Expo Push API
async function sendExpoPush(tokens: string[], title: string, body: string) {
  const messages = tokens
    .filter(t => t.startsWith('ExponentPushToken[') || t.startsWith('ExpoPushToken['))
    .map(to => ({ to, title, body, sound: 'default', priority: 'high' }));

  if (messages.length === 0) return;

  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(messages),
    });
  } catch (err) {
    logger.warn(err, '[SLA] Push notification failed');
  }
}

// Redis key for tracking sent notifications
function notifiedKey(taskId: string, threshold: string) {
  return `sla:notified:${taskId}:${threshold}`;
}

interface SLATask {
  id: string;
  hotelId: string;
  title: string;
  roomNumber: string | null;
  dueAt: Date | null;
  createdAt: Date;
  slaMinutes: number | null;
  assignedStaffId: string | null;
  status: string;
  taskType: TaskType;
  slaBreached: boolean;
}

async function collectSLATasks(): Promise<SLATask[]> {
  const tasks: SLATask[] = [];

  // 1. Internal tasks with SLA
  const internalTasks = await prisma.internalTask.findMany({
    where: {
      dueAt: { not: null },
      status: { notIn: ['COMPLETED', 'INSPECTED', 'CLOSED', 'CANCELLED'] },
    },
    select: {
      id: true, hotelId: true, title: true, roomNumber: true,
      dueAt: true, createdAt: true, slaMinutes: true,
      assignedToId: true, status: true, slaBreached: true,
    },
  });

  for (const t of internalTasks) {
    tasks.push({
      id: t.id,
      hotelId: t.hotelId,
      title: t.title,
      roomNumber: t.roomNumber,
      dueAt: t.dueAt,
      createdAt: t.createdAt,
      slaMinutes: t.slaMinutes,
      assignedStaffId: t.assignedToId,
      status: t.status,
      taskType: 'INTERNAL',
      slaBreached: t.slaBreached,
    });
  }

  // 2. Service requests with SLA
  const serviceRequests = await prisma.serviceRequest.findMany({
    where: {
      dueAt: { not: null },
      status: { notIn: ['done', 'cancelled'] },
    },
    select: {
      id: true, hotelId: true, roomNumber: true,
      dueAt: true, createdAt: true, slaMinutes: true,
      assignedStaffId: true, status: true, slaBreached: true,
      category: { select: { name: true } },
    },
  });

  for (const sr of serviceRequests) {
    tasks.push({
      id: sr.id,
      hotelId: sr.hotelId,
      title: sr.category?.name || 'Service Request',
      roomNumber: sr.roomNumber,
      dueAt: sr.dueAt,
      createdAt: sr.createdAt,
      slaMinutes: sr.slaMinutes,
      assignedStaffId: sr.assignedStaffId,
      status: sr.status,
      taskType: 'SERVICE_REQUEST',
      slaBreached: sr.slaBreached,
    });
  }

  // 3. Orders with SLA
  const orders = await prisma.order.findMany({
    where: {
      dueAt: { not: null },
      status: { notIn: ['DELIVERED', 'COMPLETED', 'CANCELLED'] },
    },
    select: {
      id: true, hotelId: true, orderNumber: true, roomNumber: true,
      dueAt: true, createdAt: true, slaMinutes: true,
      assignedStaffId: true, status: true, slaBreached: true,
    },
  });

  for (const o of orders) {
    tasks.push({
      id: o.id,
      hotelId: o.hotelId,
      title: `Order ${o.orderNumber}`,
      roomNumber: o.roomNumber,
      dueAt: o.dueAt,
      createdAt: o.createdAt,
      slaMinutes: o.slaMinutes,
      assignedStaffId: o.assignedStaffId,
      status: o.status,
      taskType: 'ORDER',
      slaBreached: o.slaBreached,
    });
  }

  return tasks;
}

async function markSLABreached(taskId: string, taskType: TaskType) {
  if (taskType === 'INTERNAL') {
    await prisma.internalTask.update({ where: { id: taskId }, data: { slaBreached: true } });
  } else if (taskType === 'SERVICE_REQUEST') {
    await prisma.serviceRequest.update({ where: { id: taskId }, data: { slaBreached: true } });
  } else if (taskType === 'ORDER') {
    await prisma.order.update({ where: { id: taskId }, data: { slaBreached: true } });
  }
}

async function checkSLAViolations() {
  const tasks = await collectSLATasks();
  if (tasks.length === 0) return;

  const now = Date.now();

  // Pre-compute which (task, threshold) pairs need checking
  const keysToCheck: { task: SLATask; threshold: typeof THRESHOLDS[number]; key: string }[] = [];
  for (const task of tasks) {
    if (!task.dueAt || !task.slaMinutes) continue;
    const slaMs = task.slaMinutes * 60 * 1000;
    const elapsedMs = now - task.createdAt.getTime();
    const elapsedPct = (elapsedMs / slaMs) * 100;
    for (const threshold of THRESHOLDS) {
      if (elapsedPct >= threshold.pct) {
        keysToCheck.push({ task, threshold, key: notifiedKey(task.id, threshold.label) });
      }
    }
  }

  if (keysToCheck.length === 0) return;

  // Batch check already-notified keys via mget
  const allKeys = keysToCheck.map(k => k.key);
  const alreadyNotified = await redis.mget(...allKeys);
  const alreadyNotifiedSet = new Set(
    allKeys.filter((_, i) => alreadyNotified[i] !== null),
  );

  // Pipeline to set all new notification keys
  const pipeline = redis.pipeline();

  for (const { task, threshold, key } of keysToCheck) {
    if (alreadyNotifiedSet.has(key)) continue;

    // Mark as notified (TTL 36h) via pipeline
    pipeline.set(key, '1', 'EX', 36 * 3600);

    const slaMs = task.slaMinutes! * 60 * 1000;
    const elapsedMs = now - task.createdAt.getTime();
    const elapsedPct = (elapsedMs / slaMs) * 100;

    // Build notification
    const location = task.roomNumber ? `Room ${task.roomNumber}` : 'Internal';
    const timeLeft = task.dueAt!.getTime() > now
      ? `${Math.round((task.dueAt!.getTime() - now) / 60000)}m left`
      : `${Math.round((now - task.dueAt!.getTime()) / 60000)}m overdue`;

    const title = `${threshold.emoji} SLA ${threshold.label.toUpperCase()}: ${task.title}`;
    const body = `${location} · ${timeLeft} · ${task.taskType}`;

    // Emit event via TaskEventBus
    taskEventBus.emitTaskEvent(threshold.event, {
      taskId: task.id,
      taskType: task.taskType,
      hotelId: task.hotelId,
      status: task.status,
      timestamp: new Date(),
      meta: {
        threshold: threshold.label,
        thresholdPct: threshold.pct,
        elapsedPct: Math.round(elapsedPct),
      },
    });

    // Mark SLA as breached if at 100%+ and not already marked
    if (threshold.pct >= 100 && !task.slaBreached) {
      await markSLABreached(task.id, task.taskType);

      // Auto-escalation on breach
      handleAutoEscalation(task.id, task.taskType).catch(err => {
        logger.warn(err, `[SLA] Auto-escalation failed for ${task.id}`);
      });

      // Recalculate ETA on breach
      recalculateAndUpdateETA(task.id, task.taskType, task.hotelId).catch(err => {
        logger.warn(err, `[SLA] ETA recalc failed for ${task.id}`);
      });
    }

    // Collect push tokens
    const tokens: string[] = [];
    if (task.assignedStaffId) {
      const token = await getStaffPushToken(task.assignedStaffId);
      if (token) tokens.push(token);
    }
    const supervisorTokens = await getSupervisorsOnShift(task.hotelId);
    tokens.push(...supervisorTokens);

    const uniqueTokens = [...new Set(tokens)];
    if (uniqueTokens.length > 0) {
      await sendExpoPush(uniqueTokens, title, body);
      logger.info(`[SLA] Sent ${threshold.label} alert for ${task.taskType}:${task.id} to ${uniqueTokens.length} device(s)`);
    }
  }

  // Execute all Redis SET commands in batch
  await pipeline.exec();
}

// Run every 5 minutes
cron.schedule('*/5 * * * *', async () => {
  try {
    await checkSLAViolations();
  } catch (err) {
    logger.error(err, '[SLA Monitor] Error');
  }
});

logger.info('[SLA Monitor] Cron job registered (every 5 min) — covers InternalTask, ServiceRequest, Order');
