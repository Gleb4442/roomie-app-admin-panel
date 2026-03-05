/**
 * TMS Webhook endpoint — receives external TMS updates.
 * POST /api/v1/webhooks/tms/:hotelId
 */

import { Router, Request, Response } from 'express';
import { processIncomingWebhook } from './tmsAdapterManager';

const router = Router();

router.post('/tms/:hotelId', async (req: Request, res: Response) => {
  const { hotelId } = req.params;
  const signature = req.headers['x-webhook-secret'] as string | undefined;

  const result = await processIncomingWebhook(hotelId as string, req.body, signature);

  if (result.processed) {
    res.json({ ok: true });
  } else {
    res.status(400).json({ ok: false, error: result.error });
  }
});

export default router;
