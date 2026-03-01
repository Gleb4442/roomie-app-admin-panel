import { Router } from 'express';
import { hotelController } from './hotel.controller';

const router = Router();

router.get('/:id', hotelController.getById);

export default router;
