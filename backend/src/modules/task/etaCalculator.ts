/**
 * ETA Calculator
 *
 * Estimates task completion time based on:
 *   1. Category default ETA
 *   2. Historical average completion time (same category, same hotel)
 *   3. Current staff workload factor
 *   4. Time-of-day factor (busier during peak hours)
 *   5. Priority coefficient (URGENT tasks get lower ETA)
 *
 * Results are rounded to nearest 5 minutes, minimum 5 minutes.
 */

import { prisma } from '../../config/database';
import { taskEventBus, TaskEvent } from './taskEventBus';
import type { TaskType } from './taskEventBus';

interface EstimateOptions {
  categoryId?: string;
  taskType?: TaskType;
  priority?: string;
  hotelId: string;
}

const PRIORITY_COEFFICIENT: Record<string, number> = {
  URGENT: 0.6,
  HIGH: 0.8,
  NORMAL: 1.0,
  LOW: 1.2,
};

const DEFAULT_ETA_MINUTES = 30;

export async function estimateETA(options: EstimateOptions): Promise<number> {
  const { categoryId, hotelId, priority = 'NORMAL' } = options;

  // 1. Category default
  let categoryEta: number | null = null;
  if (categoryId) {
    const cat = await prisma.serviceCategory.findUnique({
      where: { id: categoryId },
      select: { defaultEtaMinutes: true, estimatedMinutes: true },
    });
    categoryEta = cat?.defaultEtaMinutes ?? cat?.estimatedMinutes ?? null;
  }

  // 2. Historical average (last 30 days, same hotel + category)
  let historicalAvg: number | null = null;
  if (categoryId) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const completedRequests = await prisma.serviceRequest.findMany({
      where: {
        hotelId,
        categoryId,
        completedAt: { not: null },
        createdAt: { gte: thirtyDaysAgo },
      },
      select: { createdAt: true, completedAt: true },
      take: 50,
      orderBy: { completedAt: 'desc' },
    });

    if (completedRequests.length >= 3) {
      const totalMinutes = completedRequests.reduce((sum, r) => {
        const diff = (r.completedAt!.getTime() - r.createdAt.getTime()) / 60000;
        return sum + diff;
      }, 0);
      historicalAvg = totalMinutes / completedRequests.length;
    }
  }

  // 3. Base ETA: prefer historical, then category default, then global default
  let baseEta = historicalAvg ?? categoryEta ?? DEFAULT_ETA_MINUTES;

  // 4. Workload factor: count active tasks across all 3 task types
  const [intCount, srCount, orderCount] = await Promise.all([
    prisma.internalTask.count({
      where: { hotelId, status: { in: ['ASSIGNED', 'IN_PROGRESS'] } },
    }),
    prisma.serviceRequest.count({
      where: { hotelId, status: { in: ['confirmed', 'in_progress', 'accepted'] } },
    }),
    prisma.order.count({
      where: { hotelId, status: { in: ['CONFIRMED', 'PREPARING', 'IN_TRANSIT'] } },
    }),
  ]);
  const activeTaskCount = intCount + srCount + orderCount;
  const workloadFactor = activeTaskCount > 20 ? 1.3 : activeTaskCount > 10 ? 1.15 : 1.0;

  // 5. Time-of-day factor (peak: 11-14, 18-21)
  const hour = new Date().getHours();
  const isPeakHour = (hour >= 11 && hour <= 14) || (hour >= 18 && hour <= 21);
  const timeFactor = isPeakHour ? 1.2 : 1.0;

  // 6. Priority coefficient
  const priorityCoeff = PRIORITY_COEFFICIENT[priority] ?? 1.0;

  // Calculate final ETA
  let eta = baseEta * workloadFactor * timeFactor * priorityCoeff;

  // Round to nearest 5 minutes, minimum 5
  eta = Math.max(5, Math.round(eta / 5) * 5);

  return eta;
}

export async function recalculateAndUpdateETA(
  taskId: string,
  taskType: TaskType,
  hotelId: string,
): Promise<number | null> {
  const now = new Date();

  // Get task to determine category/priority
  let categoryId: string | undefined;
  let priority = 'NORMAL';

  if (taskType === 'SERVICE_REQUEST') {
    const sr = await prisma.serviceRequest.findUnique({
      where: { id: taskId },
      select: { categoryId: true, priority: true },
    });
    if (!sr) return null;
    categoryId = sr.categoryId;
    priority = sr.priority;
  } else if (taskType === 'INTERNAL') {
    const t = await prisma.internalTask.findUnique({
      where: { id: taskId },
      select: { priority: true },
    });
    if (!t) return null;
    priority = t.priority;
  } else if (taskType === 'ORDER') {
    const o = await prisma.order.findUnique({
      where: { id: taskId },
      select: { priority: true },
    });
    if (!o) return null;
    priority = o.priority;
  }

  const eta = await estimateETA({ categoryId, taskType, priority, hotelId });

  // Update the task with new ETA
  if (taskType === 'INTERNAL') {
    await prisma.internalTask.update({
      where: { id: taskId },
      data: { etaMinutes: eta, etaUpdatedAt: now },
    });
  } else if (taskType === 'SERVICE_REQUEST') {
    await prisma.serviceRequest.update({
      where: { id: taskId },
      data: { etaMinutes: eta, etaUpdatedAt: now },
    });
  } else if (taskType === 'ORDER') {
    await prisma.order.update({
      where: { id: taskId },
      data: { etaMinutes: eta, etaUpdatedAt: now },
    });
  }

  // Emit ETA updated event
  taskEventBus.emitTaskEvent(TaskEvent.TASK_ETA_UPDATED, {
    taskId,
    taskType,
    hotelId,
    status: 'ETA_UPDATED',
    timestamp: now,
    meta: { etaMinutes: eta },
  });

  return eta;
}
