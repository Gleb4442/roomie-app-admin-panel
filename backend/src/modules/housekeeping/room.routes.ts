import { Router } from 'express';
import * as ctrl from './room.controller';
import { asyncHandler } from '../../shared/utils/asyncHandler';
import { authenticateDashboardManager } from '../../shared/middleware/dashboardAuth';

// Dashboard routes — mounted at /api/dashboard/housekeeping
const dashboardRouter = Router();
dashboardRouter.use(authenticateDashboardManager);

dashboardRouter.get('/:hotelId/board', asyncHandler(ctrl.getBoard));
dashboardRouter.get('/:hotelId/rooms', asyncHandler(ctrl.listRooms));
dashboardRouter.get('/:hotelId/rooms/:roomId', asyncHandler(ctrl.getRoomDetail));
dashboardRouter.post('/:hotelId/rooms/bulk', asyncHandler(ctrl.bulkCreateRooms));
dashboardRouter.patch('/:hotelId/rooms/:roomId/status', asyncHandler(ctrl.updateRoomStatus));
dashboardRouter.patch('/:hotelId/rooms/:roomId/assign', asyncHandler(ctrl.assignCleaner));
dashboardRouter.patch('/:hotelId/rooms/:roomId/rush', asyncHandler(ctrl.toggleRush));
dashboardRouter.patch('/:hotelId/rooms/:roomId/dnd', asyncHandler(ctrl.toggleDND));

export { dashboardRouter };
