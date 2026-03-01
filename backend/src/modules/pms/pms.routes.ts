import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database';
import { authenticateGuestJWT } from '../../shared/middleware/auth';
import { AuthenticatedRequest } from '../../shared/types';
import { AppError } from '../../shared/middleware/errorHandler';
import { PMSFactory } from './PMSFactory';
import { pmsSyncService } from './pmsSyncService';
import { pmsWebhookHandler } from './pmsWebhookHandler';
import { logger } from '../../shared/utils/logger';

const router = Router();

function getParam(param: string | string[] | undefined): string {
  return Array.isArray(param) ? param[0] : param || '';
}

// ──── Webhook endpoint (no auth — PMS calls this) ──

router.post('/webhooks/pms/:hotelId', async (req: Request, res: Response) => {
  const hotelId = getParam(req.params.hotelId);

  // Respond immediately so PMS doesn't timeout
  res.status(200).json({ received: true });

  // Process in background
  pmsWebhookHandler.process(hotelId, req.body, req.headers as Record<string, string | string[] | undefined>).catch((err) => {
    logger.error({ hotelId, error: err }, 'PMS webhook processing error');
  });
});

// ──── Protected routes (JWT required) ───────────

const configurePMSSchema = z.object({
  pmsType: z.enum(['servio', 'easyms']),
  credentials: z.record(z.string()),
  pmsHotelId: z.string().optional(),
  syncMode: z.enum(['POLLING', 'WEBHOOK', 'MANUAL', 'DISABLED']).default('POLLING'),
  webhookSecret: z.string().optional(),
});

router.post(
  '/hotels/:hotelId/pms',
  authenticateGuestJWT,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const hotelId = getParam(req.params.hotelId);
      const data = configurePMSSchema.parse(req.body);

      const config = await prisma.hotelPMSConfig.upsert({
        where: { hotelId },
        update: {
          pmsType: data.pmsType,
          credentials: data.credentials,
          pmsHotelId: data.pmsHotelId,
          syncMode: data.syncMode,
          webhookSecret: data.webhookSecret,
          isActive: true,
        },
        create: {
          hotelId,
          pmsType: data.pmsType,
          credentials: data.credentials,
          pmsHotelId: data.pmsHotelId,
          syncMode: data.syncMode,
          webhookSecret: data.webhookSecret,
          isActive: true,
        },
      });

      res.json({
        success: true,
        data: {
          id: config.id,
          hotelId: config.hotelId,
          pmsType: config.pmsType,
          pmsHotelId: config.pmsHotelId,
          syncMode: config.syncMode,
          isActive: config.isActive,
          lastSyncAt: config.lastSyncAt,
          syncEnabled: config.syncEnabled,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  '/hotels/:hotelId/pms',
  authenticateGuestJWT,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const hotelId = getParam(req.params.hotelId);

      const config = await prisma.hotelPMSConfig.findUnique({
        where: { hotelId },
      });

      if (!config) {
        throw new AppError(404, 'PMS not configured for this hotel');
      }

      res.json({
        success: true,
        data: {
          id: config.id,
          hotelId: config.hotelId,
          pmsType: config.pmsType,
          pmsHotelId: config.pmsHotelId,
          syncMode: config.syncMode,
          isActive: config.isActive,
          lastSyncAt: config.lastSyncAt,
          syncEnabled: config.syncEnabled,
          syncIntervalMinutes: config.syncIntervalMinutes,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  '/hotels/:hotelId/pms/test',
  authenticateGuestJWT,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const hotelId = getParam(req.params.hotelId);

      const config = await prisma.hotelPMSConfig.findUnique({
        where: { hotelId },
      });

      if (!config) {
        throw new AppError(404, 'PMS not configured for this hotel');
      }

      const adapter = PMSFactory.create(config);
      const result = await adapter.testConnection();

      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  '/hotels/:hotelId/pms/sync',
  authenticateGuestJWT,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const hotelId = getParam(req.params.hotelId);

      const config = await prisma.hotelPMSConfig.findUnique({
        where: { hotelId },
      });

      if (!config || !config.isActive) {
        throw new AppError(404, 'PMS not configured or inactive for this hotel');
      }

      const result = await pmsSyncService.syncHotel(hotelId);

      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  '/hotels/:hotelId/pms/sync-status',
  authenticateGuestJWT,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const hotelId = getParam(req.params.hotelId);

      const config = await prisma.hotelPMSConfig.findUnique({
        where: { hotelId },
      });

      if (!config) {
        throw new AppError(404, 'PMS not configured for this hotel');
      }

      res.json({
        success: true,
        data: {
          lastSyncAt: config.lastSyncAt,
          syncMode: config.syncMode,
          syncEnabled: config.syncEnabled,
          isActive: config.isActive,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
