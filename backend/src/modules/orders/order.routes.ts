import { Router } from 'express';
import { authenticateGuestJWT } from '../../shared/middleware/auth';
import * as orderCtrl from './order.controller';

const router = Router();

// Guest endpoints (authenticated)
router.post('/', authenticateGuestJWT, orderCtrl.create);
router.get('/', authenticateGuestJWT, orderCtrl.list);
router.get('/:id', authenticateGuestJWT, orderCtrl.getById);
router.get('/:id/track', authenticateGuestJWT, orderCtrl.track);
router.put('/:id/cancel', authenticateGuestJWT, orderCtrl.cancel);

export default router;
