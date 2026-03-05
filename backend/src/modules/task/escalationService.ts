/**
 * Escalation Service
 *
 * Handles task escalation through the chain:
 *   Level 0: Staff (default)
 *   Level 1: Supervisor
 *   Level 2: Head of Department
 *   Level 3: General Manager
 *
 * Can be triggered manually (staff escalates) or automatically (SLA breach).
 */

import { prisma } from '../../config/database';
import { taskEventBus, TaskEvent } from './taskEventBus';
import type { TaskType } from './taskEventBus';
import { recordStatusChange } from './taskStatusTracker';

const DEFAULT_ESCALATION_CHAIN = [
  { level: 1, targetRole: 'SUPERVISOR' },
  { level: 2, targetRole: 'HEAD_OF_DEPT' },
  { level: 3, targetRole: 'GENERAL_MANAGER' },
];

interface EscalateParams {
  taskId: string;
  taskType: TaskType;
  reason: string;
  source: 'staff' | 'system';
  triggeredById?: string;
}

export async function escalateTask(params: EscalateParams): Promise<{
  newLevel: number;
  targetRole: string;
}> {
  const { taskId, taskType, reason, source, triggeredById } = params;

  // Get current escalation level and hotelId
  let currentLevel = 0;
  let hotelId = '';

  if (taskType === 'INTERNAL') {
    const t = await prisma.internalTask.findUnique({
      where: { id: taskId },
      select: { escalationLevel: true, hotelId: true },
    });
    if (!t) throw new Error('TASK_NOT_FOUND');
    currentLevel = t.escalationLevel;
    hotelId = t.hotelId;
  } else if (taskType === 'SERVICE_REQUEST') {
    const sr = await prisma.serviceRequest.findUnique({
      where: { id: taskId },
      select: { escalationLevel: true, hotelId: true },
    });
    if (!sr) throw new Error('TASK_NOT_FOUND');
    currentLevel = sr.escalationLevel;
    hotelId = sr.hotelId;
  } else if (taskType === 'ORDER') {
    const o = await prisma.order.findUnique({
      where: { id: taskId },
      select: { escalationLevel: true, hotelId: true },
    });
    if (!o) throw new Error('TASK_NOT_FOUND');
    currentLevel = o.escalationLevel;
    hotelId = o.hotelId;
  }

  // Get escalation chain from TMS config, or use default
  const tmsConfig = await prisma.hotelTMSConfig.findUnique({
    where: { hotelId },
    select: { escalationChain: true },
  });
  const chain = (tmsConfig?.escalationChain as any[]) ?? DEFAULT_ESCALATION_CHAIN;

  // Determine next level
  const newLevel = currentLevel + 1;
  const chainStep = chain.find((c: any) => c.level === newLevel);
  const targetRole = chainStep?.targetRole ?? 'GENERAL_MANAGER';

  // Update escalation level on the task
  if (taskType === 'INTERNAL') {
    await prisma.internalTask.update({
      where: { id: taskId },
      data: { escalationLevel: newLevel },
    });
  } else if (taskType === 'SERVICE_REQUEST') {
    await prisma.serviceRequest.update({
      where: { id: taskId },
      data: { escalationLevel: newLevel },
    });
  } else if (taskType === 'ORDER') {
    await prisma.order.update({
      where: { id: taskId },
      data: { escalationLevel: newLevel },
    });
  }

  // Record in audit trail
  recordStatusChange({
    taskId,
    taskType,
    hotelId,
    fromStatus: `escalation_level_${currentLevel}`,
    toStatus: `escalation_level_${newLevel}`,
    changedById: triggeredById,
    changedByType: source,
    reason: `Escalated: ${reason}`,
  }).catch(() => {});

  // Emit escalation event
  taskEventBus.emitTaskEvent(TaskEvent.TASK_ESCALATED, {
    taskId,
    taskType,
    hotelId,
    status: 'ESCALATED',
    changedBy: triggeredById
      ? { id: triggeredById, type: source }
      : undefined,
    timestamp: new Date(),
    meta: { newLevel, targetRole, reason },
  });

  return { newLevel, targetRole };
}

/**
 * Auto-escalation triggered by SLA breach.
 * Called by the SLA monitor when a task breaches its SLA.
 */
export async function handleAutoEscalation(taskId: string, taskType: TaskType) {
  return escalateTask({
    taskId,
    taskType,
    reason: 'SLA breached — automatic escalation',
    source: 'system',
  });
}
