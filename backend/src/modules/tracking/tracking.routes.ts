import { Router } from 'express';
import { trackingController } from './tracking.controller';

const router = Router();

router.post('/app-open', trackingController.trackAppOpen);

export default router;
