/**
 * TMS Adapter Manager
 *
 * Handles dual-write (local first, then external TMS), gap-filling for
 * adapters missing certain statuses, and webhook processing.
 *
 * Subscribes to TaskEventBus to automatically sync status changes to external TMS.
 */

import crypto from 'crypto';
import { prisma } from '../../config/database';
import { TMSFactory } from './tmsFactory';
import { taskEventBus, TaskEvent } from './taskEventBus';
import type { TaskType, TaskEventPayload } from './taskEventBus';
import { TMSTask } from './types';
import { logger } from '../../shared/utils/logger';

// ── Sync to External TMS ────────────────────────────────────

async function syncTaskToExternal(
  hotelId: string,
  taskId: string,
  taskType: TaskType,
  status: string,
) {
  const tmsConfig = await prisma.hotelTMSConfig.findUnique({ where: { hotelId } });
  if (!tmsConfig || !tmsConfig.enabled || tmsConfig.provider === 'none' || tmsConfig.provider === 'built_in') {
    return;
  }

  // Check if this task type/category should be synced in hybrid mode
  if (tmsConfig.mode === 'HYBRID') {
    // Only sync categories listed in hybridCategorySlugs
    // For now, sync all — category filtering can be added later
  }

  try {
    const adapter = TMSFactory.createAdapter(tmsConfig);

    // Get external ID for this task
    let externalId: string | null = null;

    if (taskType === 'INTERNAL') {
      const t = await prisma.internalTask.findUnique({ where: { id: taskId }, select: { externalTmsId: true } });
      externalId = t?.externalTmsId ?? null;
    } else if (taskType === 'SERVICE_REQUEST') {
      const sr = await prisma.serviceRequest.findUnique({ where: { id: taskId }, select: { externalTaskId: true } });
      externalId = sr?.externalTaskId ?? null;
    }

    if (externalId) {
      await adapter.updateTaskStatus(externalId, status);
      await updateSyncStatus(taskId, taskType, 'SYNCED');
    }
  } catch (err) {
    logger.error(err, `[TMS] Failed to sync ${taskType}:${taskId} to external TMS`);
    await updateSyncStatus(taskId, taskType, 'SYNC_FAILED');
  }
}

async function updateSyncStatus(taskId: string, taskType: TaskType, syncStatus: string) {
  if (taskType === 'INTERNAL') {
    await prisma.internalTask.update({ where: { id: taskId }, data: { syncStatus } });
  } else if (taskType === 'SERVICE_REQUEST') {
    await prisma.serviceRequest.update({ where: { id: taskId }, data: { syncStatus } });
  } else if (taskType === 'ORDER') {
    await prisma.order.update({ where: { id: taskId }, data: { syncStatus } });
  }
}

// ── Process Incoming Webhook ────────────────────────────────

export async function processIncomingWebhook(
  hotelId: string,
  payload: any,
  signature?: string,
): Promise<{ processed: boolean; error?: string }> {
  const tmsConfig = await prisma.hotelTMSConfig.findUnique({ where: { hotelId } });
  if (!tmsConfig || !tmsConfig.enabled) {
    return { processed: false, error: 'TMS not configured or disabled' };
  }

  // Verify webhook signature if configured (timing-safe comparison)
  if (tmsConfig.webhookSecret) {
    if (!signature) {
      return { processed: false, error: 'Missing webhook signature' };
    }
    const expected = Buffer.from(tmsConfig.webhookSecret);
    const received = Buffer.from(signature);
    if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) {
      return { processed: false, error: 'Invalid webhook signature' };
    }
  }

  try {
    const adapter = TMSFactory.createAdapter(tmsConfig);
    const parsed = adapter.parseWebhook(payload, signature);
    if (!parsed) {
      return { processed: false, error: 'Unrecognized webhook payload' };
    }

    // Find the local task by external ID
    const sr = await prisma.serviceRequest.findFirst({
      where: { hotelId, externalTaskId: parsed.externalId },
    });

    if (sr) {
      await prisma.serviceRequest.update({
        where: { id: sr.id },
        data: { status: parsed.status.toLowerCase() },
      });
      logger.info({ taskId: sr.id, externalStatus: parsed.status }, '[TMS] Webhook updated ServiceRequest');
      return { processed: true };
    }

    const internal = await prisma.internalTask.findFirst({
      where: { hotelId, externalTmsId: parsed.externalId },
    });

    if (internal) {
      await prisma.internalTask.update({
        where: { id: internal.id },
        data: { status: parsed.status as any },
      });
      logger.info({ taskId: internal.id, externalStatus: parsed.status }, '[TMS] Webhook updated InternalTask');
      return { processed: true };
    }

    return { processed: false, error: 'No matching local task found' };
  } catch (err) {
    logger.error(err, '[TMS] Webhook processing failed');
    return { processed: false, error: 'Processing error' };
  }
}

// ── Event Bus Listeners ─────────────────────────────────────

const SYNC_EVENTS = [
  TaskEvent.TASK_ASSIGNED,
  TaskEvent.TASK_ACCEPTED,
  TaskEvent.TASK_IN_PROGRESS,
  TaskEvent.TASK_COMPLETED,
  TaskEvent.TASK_CANCELLED,
  TaskEvent.TASK_ESCALATED,
];

for (const event of SYNC_EVENTS) {
  taskEventBus.on(event, (payload: TaskEventPayload) => {
    syncTaskToExternal(payload.hotelId, payload.taskId, payload.taskType, payload.status).catch(err => {
      logger.warn(err, `[TMS] Sync failed for event ${event}`);
    });
  });
}

logger.info('[TMS AdapterManager] Event bus listeners registered for external sync');
