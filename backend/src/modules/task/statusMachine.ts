/**
 * Status Machine — defines valid task status transitions per spec section 5.2.
 *
 * Also provides role-based action availability per spec section 12.2.
 */

import { TaskStatus, StaffRole } from '@prisma/client';
import type { TaskType } from './taskEventBus';

// ── Valid Transitions ────────────────────────────────────────

const INTERNAL_TRANSITIONS: Record<string, string[]> = {
  NEW:         ['ASSIGNED', 'CANCELLED'],
  ASSIGNED:    ['ACCEPTED', 'IN_PROGRESS', 'CANCELLED', 'ESCALATED'],
  ACCEPTED:    ['IN_PROGRESS', 'ON_HOLD', 'CANCELLED', 'ESCALATED'],
  IN_PROGRESS: ['ON_HOLD', 'COMPLETED', 'CANCELLED', 'ESCALATED'],
  ON_HOLD:     ['IN_PROGRESS', 'CANCELLED', 'ESCALATED'],
  COMPLETED:   ['INSPECTED', 'IN_PROGRESS'], // re-open if inspection fails
  INSPECTED:   ['CLOSED'],
  ESCALATED:   ['ASSIGNED', 'IN_PROGRESS', 'CANCELLED'],
  CLOSED:      [],
  CANCELLED:   [],
};

// ServiceRequest uses lowercase statuses internally but we validate in TaskStatus terms
const SR_TRANSITIONS: Record<string, string[]> = {
  NEW:         ['ASSIGNED', 'CANCELLED'],
  ASSIGNED:    ['ACCEPTED', 'IN_PROGRESS', 'CANCELLED', 'ESCALATED'],
  ACCEPTED:    ['IN_PROGRESS', 'CANCELLED', 'ESCALATED'],
  IN_PROGRESS: ['ON_HOLD', 'COMPLETED', 'CANCELLED', 'ESCALATED'],
  ON_HOLD:     ['IN_PROGRESS', 'CANCELLED'],
  COMPLETED:   ['CLOSED'],
  ESCALATED:   ['ASSIGNED', 'IN_PROGRESS', 'CANCELLED'],
  CLOSED:      [],
  CANCELLED:   [],
};

const ORDER_TRANSITIONS: Record<string, string[]> = {
  NEW:         ['ASSIGNED', 'CANCELLED'],
  ASSIGNED:    ['ACCEPTED', 'IN_PROGRESS', 'CANCELLED'],
  ACCEPTED:    ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED:   ['CLOSED'],
  CLOSED:      [],
  CANCELLED:   [],
};

function getTransitionMap(taskType: TaskType): Record<string, string[]> {
  switch (taskType) {
    case 'INTERNAL': return INTERNAL_TRANSITIONS;
    case 'SERVICE_REQUEST': return SR_TRANSITIONS;
    case 'ORDER': return ORDER_TRANSITIONS;
  }
}

// ServiceRequest uses lowercase statuses in DB — normalize to uppercase for transition validation
const SR_STATUS_NORMALIZE: Record<string, string> = {
  pending: 'NEW',
  confirmed: 'ASSIGNED',
  accepted: 'ACCEPTED',
  in_progress: 'IN_PROGRESS',
  on_hold: 'ON_HOLD',
  completed: 'COMPLETED',
  done: 'COMPLETED',
  cancelled: 'CANCELLED',
  rejected: 'CANCELLED',
  escalated: 'ESCALATED',
  closed: 'CLOSED',
};

function normalizeStatus(taskType: TaskType, status: string): string {
  if (taskType === 'SERVICE_REQUEST') {
    return SR_STATUS_NORMALIZE[status] ?? status;
  }
  return status;
}

export function validateTransition(
  taskType: TaskType,
  fromStatus: string,
  toStatus: string,
): boolean {
  const map = getTransitionMap(taskType);
  const normalizedFrom = normalizeStatus(taskType, fromStatus);
  const normalizedTo = normalizeStatus(taskType, toStatus);
  const allowed = map[normalizedFrom];
  if (!allowed) return false;
  return allowed.includes(normalizedTo);
}

export function getValidNextStatuses(
  taskType: TaskType,
  currentStatus: string,
): string[] {
  const map = getTransitionMap(taskType);
  const normalized = normalizeStatus(taskType, currentStatus);
  return map[normalized] ?? [];
}

// ── Role-Based Actions ────────────────────────────────────────

export type TaskAction =
  | 'accept'
  | 'decline'
  | 'start'
  | 'pause'
  | 'resume'
  | 'complete'
  | 'cancel'
  | 'escalate'
  | 'reassign'
  | 'inspect'
  | 'close'
  | 'reopen';

interface ActionCheck {
  action: TaskAction;
  targetStatus?: string;
}

const ACTION_MAP: Record<string, ActionCheck[]> = {
  NEW:         [{ action: 'cancel', targetStatus: 'CANCELLED' }],
  ASSIGNED:    [
    { action: 'accept', targetStatus: 'ACCEPTED' },
    { action: 'decline' }, // triggers re-assignment, not a status change
    { action: 'start', targetStatus: 'IN_PROGRESS' },
    { action: 'escalate', targetStatus: 'ESCALATED' },
    { action: 'cancel', targetStatus: 'CANCELLED' },
  ],
  ACCEPTED:    [
    { action: 'start', targetStatus: 'IN_PROGRESS' },
    { action: 'pause', targetStatus: 'ON_HOLD' },
    { action: 'escalate', targetStatus: 'ESCALATED' },
    { action: 'cancel', targetStatus: 'CANCELLED' },
  ],
  IN_PROGRESS: [
    { action: 'pause', targetStatus: 'ON_HOLD' },
    { action: 'complete', targetStatus: 'COMPLETED' },
    { action: 'escalate', targetStatus: 'ESCALATED' },
    { action: 'cancel', targetStatus: 'CANCELLED' },
  ],
  ON_HOLD:     [
    { action: 'resume', targetStatus: 'IN_PROGRESS' },
    { action: 'escalate', targetStatus: 'ESCALATED' },
    { action: 'cancel', targetStatus: 'CANCELLED' },
  ],
  COMPLETED:   [
    { action: 'inspect', targetStatus: 'INSPECTED' },
    { action: 'reopen', targetStatus: 'IN_PROGRESS' },
  ],
  INSPECTED:   [
    { action: 'close', targetStatus: 'CLOSED' },
  ],
  ESCALATED:   [
    { action: 'reassign', targetStatus: 'ASSIGNED' },
    { action: 'start', targetStatus: 'IN_PROGRESS' },
    { action: 'cancel', targetStatus: 'CANCELLED' },
  ],
};

// Actions restricted by role
const SUPERVISOR_ONLY_ACTIONS: Set<TaskAction> = new Set(['reassign', 'inspect', 'close']);
const MANAGER_ONLY_ACTIONS: Set<TaskAction> = new Set([]); // could add if needed

export function getAvailableActions(
  taskType: TaskType,
  currentStatus: string,
  staffRole: StaffRole,
  isAssignee: boolean,
): TaskAction[] {
  const normalizedStatus = normalizeStatus(taskType, currentStatus);
  const actions = ACTION_MAP[normalizedStatus] ?? [];

  return actions
    .filter(a => {
      // Validate that the target status transition is valid for this task type
      if (a.targetStatus && !validateTransition(taskType, currentStatus, a.targetStatus)) {
        return false;
      }

      // Role-based filtering
      if (SUPERVISOR_ONLY_ACTIONS.has(a.action)) {
        return ['SUPERVISOR', 'HEAD_OF_DEPT', 'GENERAL_MANAGER'].includes(staffRole);
      }

      // accept/decline/start only available to assignee or supervisors+
      if (['accept', 'decline', 'start', 'pause', 'resume', 'complete'].includes(a.action)) {
        return isAssignee || ['SUPERVISOR', 'HEAD_OF_DEPT', 'GENERAL_MANAGER'].includes(staffRole);
      }

      // escalate available to all staff
      if (a.action === 'escalate') return true;

      // cancel available to supervisors+ and assignee
      if (a.action === 'cancel') {
        return isAssignee || ['SUPERVISOR', 'HEAD_OF_DEPT', 'GENERAL_MANAGER'].includes(staffRole);
      }

      return true;
    })
    .map(a => a.action);
}
