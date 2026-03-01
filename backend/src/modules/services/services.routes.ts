import { Router } from 'express';
import { listServices, getService } from './services.controller';

const router = Router();

// Public endpoints
router.get('/:hotelId/services', listServices);
router.get('/:hotelId/services/:id', getService);

export default router;
