import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database';
import { authenticateGuestJWT } from '../../shared/middleware/auth';
import { AuthenticatedRequest } from '../../shared/types';
import { AppError } from '../../shared/middleware/errorHandler';
import { SMSFactory } from './SMSFactory';

const router = Router();

function getParam(param: string | string[] | undefined): string {
  return Array.isArray(param) ? param[0] : param || '';
}

// ──── Configure SMS provider ────────────────────

const configureSMSSchema = z.object({
  provider: z.enum(['twilio', 'turbosms']),
  credentials: z.record(z.string()),
  senderName: z.string().min(1).max(11),
  enabled: z.boolean().default(true),
});

router.post(
  '/hotels/:hotelId/sms',
  authenticateGuestJWT,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const hotelId = getParam(req.params.hotelId);
      const data = configureSMSSchema.parse(req.body);

      const config = await prisma.hotelSMSConfig.upsert({
        where: { hotelId },
        update: {
          provider: data.provider,
          credentials: data.credentials,
          senderName: data.senderName,
          enabled: data.enabled,
        },
        create: {
          hotelId,
          provider: data.provider,
          credentials: data.credentials,
          senderName: data.senderName,
          enabled: data.enabled,
        },
      });

      res.json({
        success: true,
        data: {
          id: config.id,
          hotelId: config.hotelId,
          provider: config.provider,
          senderName: config.senderName,
          enabled: config.enabled,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

// ──── Get SMS configuration ─────────────────────

router.get(
  '/hotels/:hotelId/sms',
  authenticateGuestJWT,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const hotelId = getParam(req.params.hotelId);

      const config = await prisma.hotelSMSConfig.findUnique({
        where: { hotelId },
      });

      if (!config) {
        throw new AppError(404, 'SMS not configured for this hotel');
      }

      res.json({
        success: true,
        data: {
          id: config.id,
          hotelId: config.hotelId,
          provider: config.provider,
          senderName: config.senderName,
          enabled: config.enabled,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

// ──── Send test SMS ─────────────────────────────

const testSMSSchema = z.object({
  phone: z.string().min(10),
  text: z.string().min(1).max(500).default('Test message from Roomie'),
});

router.post(
  '/hotels/:hotelId/sms/test',
  authenticateGuestJWT,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const hotelId = getParam(req.params.hotelId);
      const { phone, text } = testSMSSchema.parse(req.body);

      const config = await prisma.hotelSMSConfig.findUnique({
        where: { hotelId },
      });

      if (!config) {
        throw new AppError(404, 'SMS not configured for this hotel');
      }

      const adapter = SMSFactory.create(config);
      const result = await adapter.send({
        to: phone,
        text,
        senderName: config.senderName,
      });

      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
);

// ──── SMS Logs ──────────────────────────────────

const logsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.string().optional(),
  template: z.string().optional(),
});

router.get(
  '/hotels/:hotelId/sms/logs',
  authenticateGuestJWT,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const hotelId = getParam(req.params.hotelId);
      const { page, limit, status, template } = logsQuerySchema.parse(req.query);

      const where: Record<string, unknown> = { hotelId };
      if (status) where.status = status;
      if (template) where.template = template;

      const [logs, total] = await Promise.all([
        prisma.sMSLog.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.sMSLog.count({ where }),
      ]);

      res.json({
        success: true,
        data: {
          logs,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
