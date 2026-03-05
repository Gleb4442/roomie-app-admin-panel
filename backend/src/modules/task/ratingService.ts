/**
 * Rating Service
 *
 * Schedules rating requests after task completion.
 * Sends push/SSE notification to guest 3 minutes after task is marked complete.
 */

import { redis } from '../../config/redis';
import { prisma } from '../../config/database';
import { taskEventBus, TaskEvent } from './taskEventBus';
import type { TaskType } from './taskEventBus';
import { logger } from '../../shared/utils/logger';

const RATING_DELAY_MS = 3 * 60 * 1000; // 3 minutes

/**
 * Schedule a rating request to be sent to the guest after a delay.
 * Uses Redis key with TTL as a lightweight delayed job.
 */
export async function scheduleRatingRequest(
  taskId: string,
  taskType: TaskType,
  guestId: string,
  hotelId: string,
) {
  const key = `rating_request:${taskType}:${taskId}`;

  // Store the rating request data with a TTL
  await redis.set(key, JSON.stringify({ taskId, taskType, guestId, hotelId }), 'EX', 600);

  // Use setTimeout for the delay. unref() so it doesn't prevent process exit.
  // TODO: Migrate to BullMQ delayed job for cluster-safe, restart-safe scheduling.
  const timer = setTimeout(async () => {
    try {
      // Check if task was already rated
      let alreadyRated = false;

      if (taskType === 'SERVICE_REQUEST') {
        const sr = await prisma.serviceRequest.findUnique({
          where: { id: taskId },
          select: { rating: true },
        });
        alreadyRated = sr?.rating != null;
      } else if (taskType === 'ORDER') {
        const o = await prisma.order.findUnique({
          where: { id: taskId },
          select: { rating: true },
        });
        alreadyRated = o?.rating != null;
      }

      if (alreadyRated) {
        await redis.del(key);
        return;
      }

      // Publish rating request via SSE to guest
      await redis.publish(`service_request_status:${guestId}`, JSON.stringify({
        type: 'RATING_REQUEST',
        taskId,
        taskType,
        hotelId,
      }));

      logger.info(`[Rating] Sent rating request for ${taskType}:${taskId} to guest ${guestId}`);
      await redis.del(key);
    } catch (err) {
      logger.warn(err, `[Rating] Failed to send rating request for ${taskId}`);
    }
  }, RATING_DELAY_MS);
  timer.unref();
}

// Wire up: automatically schedule rating requests on task completion
taskEventBus.on(TaskEvent.TASK_COMPLETED, async (payload) => {
  const { taskId, taskType, hotelId } = payload;

  // Only for guest-facing tasks (SERVICE_REQUEST, ORDER)
  if (taskType === 'INTERNAL') return;

  let guestId: string | null = null;

  if (taskType === 'SERVICE_REQUEST') {
    const sr = await prisma.serviceRequest.findUnique({
      where: { id: taskId },
      select: { guestId: true },
    });
    guestId = sr?.guestId ?? null;
  } else if (taskType === 'ORDER') {
    const o = await prisma.order.findUnique({
      where: { id: taskId },
      select: { guestId: true },
    });
    guestId = o?.guestId ?? null;
  }

  if (guestId) {
    scheduleRatingRequest(taskId, taskType, guestId, hotelId).catch(err => {
      logger.warn(err, `[Rating] Failed to schedule rating for ${taskId}`);
    });
  }
});
