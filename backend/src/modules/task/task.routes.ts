import { Router } from 'express';
import { authenticateGuestJWT } from '../../shared/middleware/auth';
import { taskController } from './task.controller';

const router = Router();

// All task routes require guest auth
router.use(authenticateGuestJWT);

// Catalog
router.get('/:hotelId/services', taskController.getCategories);
router.get('/:hotelId/services/:categoryId', taskController.getCategory);

// Guest requests
router.post('/:hotelId/services/requests', taskController.createRequest);
router.get('/:hotelId/services/requests/my', taskController.getMyRequests);
router.post('/:hotelId/services/requests/:requestId/cancel', taskController.cancelRequest);

export default router;
