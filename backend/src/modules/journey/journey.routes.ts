import { Router } from 'express';
import { journeyController } from './journey.controller';
import { authenticateGuestJWT } from '../../shared/middleware/auth';

const router = Router();

router.get('/current-stay', authenticateGuestJWT, journeyController.getCurrentStay);
router.post('/update-stage', authenticateGuestJWT, journeyController.updateStage);

export default router;
