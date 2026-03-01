import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../shared/types';
import { prisma } from '../../config/database';
import { PMSFactory } from '../pms/PMSFactory';
import { logger } from '../../shared/utils/logger';

export async function getPreCheckinUrl(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const guestId = req.guest!.id;

    // Find the guest's current stay
    const stay = await prisma.guestStay.findFirst({
      where: {
        guestId,
        stage: { in: ['PRE_ARRIVAL', 'CHECKED_IN', 'IN_STAY'] },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!stay) {
      return res.json({ success: true, data: { url: null, available: false } });
    }

    // Check if we have a cached pre-check-in URL that hasn't expired
    if (stay.preCheckinUrl && stay.preCheckinExpiresAt && stay.preCheckinExpiresAt > new Date()) {
      return res.json({
        success: true,
        data: {
          url: stay.preCheckinUrl,
          available: true,
          completed: stay.preCheckinCompleted,
          expiresAt: stay.preCheckinExpiresAt,
        },
      });
    }

    // Try to get a dynamic URL from PMS
    const pmsConfig = await prisma.hotelPMSConfig.findUnique({
      where: { hotelId: stay.hotelId },
    });

    if (!pmsConfig || !pmsConfig.isActive) {
      // Fallback to static preCheckinUrl from PMS config
      const url = pmsConfig?.preCheckinUrl || null;
      return res.json({
        success: true,
        data: {
          url,
          available: !!url,
          completed: stay.preCheckinCompleted,
        },
      });
    }

    // If the stay has an external reservation ID, try PMS adapter
    if (stay.externalReservationId) {
      try {
        const adapter = PMSFactory.create(pmsConfig);
        const dynamicUrl = await adapter.getPreCheckinUrl(stay.externalReservationId);

        if (dynamicUrl) {
          // Cache for 24 hours
          const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
          await prisma.guestStay.update({
            where: { id: stay.id },
            data: { preCheckinUrl: dynamicUrl, preCheckinExpiresAt: expiresAt },
          });

          return res.json({
            success: true,
            data: {
              url: dynamicUrl,
              available: true,
              completed: stay.preCheckinCompleted,
              expiresAt,
            },
          });
        }
      } catch (err) {
        logger.warn({ stayId: stay.id, error: err }, 'Failed to get dynamic pre-check-in URL from PMS');
      }
    }

    // Final fallback: static URL from PMS config
    const url = pmsConfig.preCheckinUrl || null;
    res.json({
      success: true,
      data: {
        url,
        available: !!url,
        completed: stay.preCheckinCompleted,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function getPreCheckinUrlByStay(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const stayId = Array.isArray(req.params.stayId) ? req.params.stayId[0] : req.params.stayId;
    const guestId = req.guest!.id;

    const stay = await prisma.guestStay.findFirst({
      where: { id: stayId, guestId },
    });

    if (!stay) {
      return res.status(404).json({ success: false, error: 'Stay not found' });
    }

    // Check cached URL
    if (stay.preCheckinUrl && stay.preCheckinExpiresAt && stay.preCheckinExpiresAt > new Date()) {
      return res.json({
        success: true,
        data: {
          url: stay.preCheckinUrl,
          available: true,
          completed: stay.preCheckinCompleted,
          expiresAt: stay.preCheckinExpiresAt,
        },
      });
    }

    // Try PMS
    const pmsConfig = await prisma.hotelPMSConfig.findUnique({
      where: { hotelId: stay.hotelId },
    });

    if (pmsConfig?.isActive && stay.externalReservationId) {
      try {
        const adapter = PMSFactory.create(pmsConfig);
        const dynamicUrl = await adapter.getPreCheckinUrl(stay.externalReservationId);

        if (dynamicUrl) {
          const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
          await prisma.guestStay.update({
            where: { id: stay.id },
            data: { preCheckinUrl: dynamicUrl, preCheckinExpiresAt: expiresAt },
          });

          return res.json({
            success: true,
            data: { url: dynamicUrl, available: true, completed: stay.preCheckinCompleted, expiresAt },
          });
        }
      } catch (err) {
        logger.warn({ stayId, error: err }, 'Failed to get dynamic pre-check-in URL from PMS');
      }
    }

    // Fallback
    const url = pmsConfig?.preCheckinUrl || null;
    res.json({
      success: true,
      data: { url, available: !!url, completed: stay.preCheckinCompleted },
    });
  } catch (err) {
    next(err);
  }
}

export async function completePreCheckin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const guestId = req.guest!.id;

    const stay = await prisma.guestStay.findFirst({
      where: {
        guestId,
        stage: { in: ['PRE_ARRIVAL', 'CHECKED_IN', 'IN_STAY'] },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!stay) {
      return res.status(404).json({ success: false, error: 'No active stay found' });
    }

    const updated = await prisma.guestStay.update({
      where: { id: stay.id },
      data: { preCheckinCompleted: true },
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}
