/**
 * Unified Task API routes — /api/v1/tasks
 *
 * Provides task detail, rating, notes, photos, status history
 * across all 3 task models (INTERNAL, SERVICE_REQUEST, ORDER).
 */

import { Router, Request, Response } from 'express';
import { staffAuth } from '../staff/staff.middleware';
import { authenticateGuestJWT } from '../../shared/middleware/auth';
import { asyncHandler } from '../../shared/utils/asyncHandler';
import {
  getTaskDetail,
  rateTask,
  addNote,
  getTaskNotes,
  addPhoto,
  getTaskPhotos,
  getStatusHistory,
  getGuestTasks,
  getHotelTasks,
} from './unifiedTask.service';
import { authenticateDashboardManager, verifyHotelAccess } from '../../shared/middleware/dashboardAuth';
import { updateTaskStatus, assignTask } from '../staff/staff.service';
import { validateTransition, getAvailableActions } from './statusMachine';
import { escalateTask } from './escalationService';
import { autoAssignTask } from '../staff/autoAssign.service';
import type { TaskType } from './taskEventBus';

const router = Router();

const VALID_TASK_TYPES = ['INTERNAL', 'ORDER', 'SERVICE_REQUEST'];

function validateTaskType(type: string): type is TaskType {
  return VALID_TASK_TYPES.includes(type);
}

// ── Guest Task List ──────────────────────────────────────────

router.get('/guest/my', authenticateGuestJWT as any, asyncHandler(async (req: Request, res: Response) => {
  const guestId = (req as any).guest?.id;
  if (!guestId) { res.status(401).json({ error: 'Guest not authenticated' }); return; }

  const hotelId = req.query.hotelId as string | undefined;
  const tasks = await getGuestTasks(guestId, hotelId);
  res.json(tasks);
}));

// ── Hotel Task List (dashboard auth) ─────────────────────────

router.get('/hotel/:hotelId', authenticateDashboardManager as any, verifyHotelAccess as any, asyncHandler(async (req: Request, res: Response) => {
  const { hotelId } = req.params;
  const { status, taskType, slaBreached, limit } = req.query;

  const tasks = await getHotelTasks(hotelId as string, {
    status: status ? (status as string).split(',') : undefined,
    taskType: taskType as TaskType | undefined,
    slaBreached: slaBreached === 'true' ? true : slaBreached === 'false' ? false : undefined,
    limit: limit ? parseInt(limit as string, 10) : undefined,
  });

  res.json(tasks);
}));

// ── Task Detail (staff auth) ────────────────────────────────

router.get('/:taskType/:taskId', staffAuth as any, asyncHandler(async (req: Request, res: Response) => {
  const { taskType, taskId } = req.params;
  if (!validateTaskType(taskType as string)) {
    res.status(400).json({ error: 'Invalid taskType' });
    return;
  }

  const detail = await getTaskDetail(taskId as string, taskType as TaskType);
  if (!detail) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }

  res.json(detail);
}));

// ── Rating (guest auth) ─────────────────────────────────────

router.post('/:taskType/:taskId/rate', authenticateGuestJWT as any, asyncHandler(async (req: Request, res: Response) => {
  const { taskType, taskId } = req.params;
  if (!validateTaskType(taskType as string)) {
    res.status(400).json({ error: 'Invalid taskType' });
    return;
  }

  const { rating, comment } = req.body;
  if (!rating || typeof rating !== 'number' || rating < 1 || rating > 5) {
    res.status(400).json({ error: 'Rating must be 1-5' });
    return;
  }

  const guestId = (req as any).guest?.id;
  if (!guestId) {
    res.status(401).json({ error: 'Guest not authenticated' });
    return;
  }

  const result = await rateTask(taskId as string, taskType as TaskType, guestId, rating, comment);
  res.json(result);
}));

// ── Notes ────────────────────────────────────────────────────

router.get('/:taskType/:taskId/notes', staffAuth as any, asyncHandler(async (req: Request, res: Response) => {
  const { taskType, taskId } = req.params;
  if (!validateTaskType(taskType as string)) {
    res.status(400).json({ error: 'Invalid taskType' });
    return;
  }

  const notes = await getTaskNotes(taskId as string, taskType as TaskType);
  res.json(notes);
}));

router.post('/:taskType/:taskId/notes', staffAuth as any, asyncHandler(async (req: Request, res: Response) => {
  const { taskType, taskId } = req.params;
  if (!validateTaskType(taskType as string)) {
    res.status(400).json({ error: 'Invalid taskType' });
    return;
  }

  const { content, isInternal } = req.body;
  if (!content) {
    res.status(400).json({ error: 'content is required' });
    return;
  }

  const staffId = (req as any).staff?.staffId;
  const note = await addNote(
    taskId as string,
    taskType as TaskType,
    staffId,
    'staff',
    content,
    isInternal ?? false,
  );
  res.status(201).json(note);
}));

// ── Photos ───────────────────────────────────────────────────

router.get('/:taskType/:taskId/photos', staffAuth as any, asyncHandler(async (req: Request, res: Response) => {
  const { taskType, taskId } = req.params;
  if (!validateTaskType(taskType as string)) {
    res.status(400).json({ error: 'Invalid taskType' });
    return;
  }

  const photos = await getTaskPhotos(taskId as string, taskType as TaskType);
  res.json(photos);
}));

router.post('/:taskType/:taskId/photos', staffAuth as any, asyncHandler(async (req: Request, res: Response) => {
  const { taskType, taskId } = req.params;
  if (!validateTaskType(taskType as string)) {
    res.status(400).json({ error: 'Invalid taskType' });
    return;
  }

  const { url, type } = req.body;
  if (!url) {
    res.status(400).json({ error: 'url is required' });
    return;
  }

  const staffId = (req as any).staff?.staffId;
  const photo = await addPhoto(taskId as string, taskType as TaskType, staffId, url, type ?? 'issue');
  res.status(201).json(photo);
}));

// ── Status History ───────────────────────────────────────────

router.get('/:taskType/:taskId/history', staffAuth as any, asyncHandler(async (req: Request, res: Response) => {
  const { taskType, taskId } = req.params;
  if (!validateTaskType(taskType as string)) {
    res.status(400).json({ error: 'Invalid taskType' });
    return;
  }

  const history = await getStatusHistory(taskId as string, taskType as TaskType);
  res.json(history);
}));

// ── Available Actions ────────────────────────────────────────

router.get('/:taskType/:taskId/actions', staffAuth as any, asyncHandler(async (req: Request, res: Response) => {
  const { taskType, taskId } = req.params;
  if (!validateTaskType(taskType as string)) {
    res.status(400).json({ error: 'Invalid taskType' });
    return;
  }

  const detail = await getTaskDetail(taskId as string, taskType as TaskType);
  if (!detail) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }

  const staff = (req as any).staff;
  const task = detail.task;
  const assignedId = task.assignedToId ?? task.assignedStaffId;
  const isAssignee = assignedId === staff.staffId;

  const actions = getAvailableActions(taskType as TaskType, task.status, staff.role, isAssignee);
  res.json({ actions });
}));

// ── Accept Task ──────────────────────────────────────────────

router.post('/:taskType/:taskId/accept', staffAuth as any, asyncHandler(async (req: Request, res: Response) => {
  const { taskType, taskId } = req.params;
  if (!validateTaskType(taskType as string)) {
    res.status(400).json({ error: 'Invalid taskType' });
    return;
  }

  const staff = (req as any).staff;

  // Validate transition
  const detail = await getTaskDetail(taskId as string, taskType as TaskType);
  if (!detail) { res.status(404).json({ error: 'Task not found' }); return; }

  const currentStatus = detail.task.status;
  if (!validateTransition(taskType as TaskType, currentStatus, 'ACCEPTED')) {
    res.status(400).json({ error: `Cannot accept from status ${currentStatus}` });
    return;
  }

  const result = await updateTaskStatus(taskType as TaskType, taskId as string, 'ACCEPTED', staff.staffId);
  res.json(result);
}));

// ── Decline Task ─────────────────────────────────────────────

router.post('/:taskType/:taskId/decline', staffAuth as any, asyncHandler(async (req: Request, res: Response) => {
  const { taskType, taskId } = req.params;
  if (!validateTaskType(taskType as string)) {
    res.status(400).json({ error: 'Invalid taskType' });
    return;
  }

  const staff = (req as any).staff;
  const { reason } = req.body;

  const detail = await getTaskDetail(taskId as string, taskType as TaskType);
  if (!detail) { res.status(404).json({ error: 'Task not found' }); return; }

  // Re-assign to someone else, excluding this staff
  const hotelId = detail.task.hotelId;
  // Resolve department: InternalTask has .department, SR has category-based dept
  let dept = 'HOUSEKEEPING';
  if (taskType === 'INTERNAL' && detail.task.department) {
    dept = detail.task.department;
  } else if (taskType === 'SERVICE_REQUEST' && detail.task.assignedStaffId) {
    // Try to infer department from previously assigned staff
    const prevStaff = await import('../../config/database').then(m =>
      m.prisma.staffMember.findUnique({
        where: { id: detail.task.assignedStaffId },
        select: { department: true },
      }),
    );
    if (prevStaff?.department) dept = prevStaff.department;
  }
  const newAssignee = await autoAssignTask(
    hotelId, dept as any, detail.task.roomNumber ?? undefined,
    { excludeStaffIds: [staff.staffId] },
  );

  if (newAssignee) {
    await assignTask(taskType as TaskType, taskId as string, newAssignee, reason, staff.staffId);
    res.json({ success: true, reassignedTo: newAssignee });
  } else {
    // No one available — escalate
    const result = await escalateTask({
      taskId: taskId as string,
      taskType: taskType as TaskType,
      reason: reason || 'Declined, no other staff available',
      source: 'system',
      triggeredById: staff.staffId,
    });
    res.json({ success: true, escalated: true, ...result });
  }
}));

// ── Escalate Task ────────────────────────────────────────────

router.post('/:taskType/:taskId/escalate', staffAuth as any, asyncHandler(async (req: Request, res: Response) => {
  const { taskType, taskId } = req.params;
  if (!validateTaskType(taskType as string)) {
    res.status(400).json({ error: 'Invalid taskType' });
    return;
  }

  const staff = (req as any).staff;
  const { reason } = req.body;
  if (!reason) {
    res.status(400).json({ error: 'reason is required' });
    return;
  }

  const result = await escalateTask({
    taskId: taskId as string,
    taskType: taskType as TaskType,
    reason,
    source: 'staff',
    triggeredById: staff.staffId,
  });

  res.json(result);
}));

// ── Reassign Task (supervisor+) ──────────────────────────────

router.patch('/:taskType/:taskId/assign', staffAuth as any, asyncHandler(async (req: Request, res: Response) => {
  const { taskType, taskId } = req.params;
  if (!validateTaskType(taskType as string)) {
    res.status(400).json({ error: 'Invalid taskType' });
    return;
  }

  const staff = (req as any).staff;
  if (!['SUPERVISOR', 'HEAD_OF_DEPT', 'GENERAL_MANAGER'].includes(staff.role)) {
    res.status(403).json({ error: 'Only supervisors+ can reassign tasks' });
    return;
  }

  const { assignToId, note } = req.body;
  if (!assignToId) {
    res.status(400).json({ error: 'assignToId is required' });
    return;
  }

  const result = await assignTask(taskType as TaskType, taskId as string, assignToId, note, staff.staffId);
  res.json(result);
}));

// ── Update Status (generic) ─────────────────────────────────

router.patch('/:taskType/:taskId/status', staffAuth as any, asyncHandler(async (req: Request, res: Response) => {
  const { taskType, taskId } = req.params;
  if (!validateTaskType(taskType as string)) {
    res.status(400).json({ error: 'Invalid taskType' });
    return;
  }

  const staff = (req as any).staff;
  const { status, holdReason } = req.body;
  if (!status) {
    res.status(400).json({ error: 'status is required' });
    return;
  }

  // Validate transition
  const detail = await getTaskDetail(taskId as string, taskType as TaskType);
  if (!detail) { res.status(404).json({ error: 'Task not found' }); return; }

  if (!validateTransition(taskType as TaskType, detail.task.status, status)) {
    res.status(400).json({
      error: `Invalid transition from ${detail.task.status} to ${status}`,
    });
    return;
  }

  const result = await updateTaskStatus(taskType as TaskType, taskId as string, status, staff.staffId, holdReason);
  res.json(result);
}));

export default router;
