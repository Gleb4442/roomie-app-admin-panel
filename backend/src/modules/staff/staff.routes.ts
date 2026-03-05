import { Router } from 'express';
import * as ctrl from './staff.controller';
import { staffAuth, requireRole, canManageTasks } from './staff.middleware';
import * as roomCtrl from '../housekeeping/room.controller';
import { asyncHandler } from '../../shared/utils/asyncHandler';

const router = Router();

// ── Auth (public) ─────────────────────────────────────────────
router.post('/login', ctrl.login);
router.post('/login/pin', ctrl.loginByPin);

// ── Protected ─────────────────────────────────────────────────
router.use(staffAuth);

router.get('/me', ctrl.getMe);
router.get('/shift/status', ctrl.getShiftStatus);
router.post('/shift/start', ctrl.startShift);
router.post('/shift/end', ctrl.endShift);

// Task Templates
router.get('/templates', ctrl.getTemplates);

// Online staff (for supervisor assignment)
router.get('/online', requireRole('SUPERVISOR', 'HEAD_OF_DEPT', 'GENERAL_MANAGER'), ctrl.getOnlineStaff);

// Push token (for SLA alerts)
router.patch('/push-token', ctrl.savePushToken);

// Tasks — stream (SSE)
router.get('/tasks/stream', ctrl.streamTasks);

// Tasks — list + create
router.get('/tasks', ctrl.getTasks);
router.post('/tasks', requireRole('SUPERVISOR', 'HEAD_OF_DEPT', 'GENERAL_MANAGER', 'RECEPTIONIST'), ctrl.createTask);

// Auto-assignment suggestion (must be before /:taskType route)
router.get('/tasks/suggest-assignee', requireRole('SUPERVISOR', 'HEAD_OF_DEPT', 'GENERAL_MANAGER'), ctrl.suggestAssignee);

// Task — actions
router.patch('/tasks/:taskType/:taskId/status', canManageTasks, ctrl.updateStatus);
router.patch('/tasks/:taskType/:taskId/assign', requireRole('SUPERVISOR', 'HEAD_OF_DEPT', 'GENERAL_MANAGER'), ctrl.assignTask);

// Checklist
router.patch('/tasks/:taskId/checklist', ctrl.updateChecklist);

// Comments
router.get('/tasks/:taskType/:taskId/comments', ctrl.getComments);
router.post('/tasks/:taskType/:taskId/comments', ctrl.addComment);

// Housekeeping — room status (staff view)
router.get('/rooms', asyncHandler(roomCtrl.getStaffRooms));
router.patch('/rooms/:roomId/status', asyncHandler(roomCtrl.staffUpdateRoomStatus));

export default router;
