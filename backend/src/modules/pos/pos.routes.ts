import { Router, Request, Response, NextFunction } from 'express';
import { authenticateGuestJWT } from '../../shared/middleware/auth';
import { handlePosterWebhook } from './webhook.controller';
import { syncMenuFromPOS } from './menuSync.service';
import * as orderCtrl from '../orders/order.controller';

const router = Router();

// Webhook (no auth — Poster sends directly)
router.post('/webhook/poster', handlePosterWebhook);

// Admin endpoints (using guest JWT for now — replace with admin auth later)
router.post('/sync', authenticateGuestJWT, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { hotelId } = req.body;
    if (!hotelId) return res.status(400).json({ success: false, error: 'hotelId required' });
    const result = await syncMenuFromPOS(hotelId);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// Admin order management
router.get('/orders', authenticateGuestJWT, orderCtrl.adminList);
router.put('/orders/:id/status', authenticateGuestJWT, orderCtrl.adminUpdateStatus);

export default router;
