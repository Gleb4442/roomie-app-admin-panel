/**
 * Chat Integration — internal service-to-service endpoint.
 *
 * POST /api/internal/tasks/from-chat
 *
 * Called by roomie-backend when a guest creates a task via chat.
 * Authenticated with X-Internal-Service header + token.
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../../config/database';
import { recordStatusChange } from './taskStatusTracker';
import { estimateETA } from './etaCalculator';
import { routeTask } from './taskRouter';
import { logger } from '../../shared/utils/logger';

const router = Router();

const INTERNAL_SERVICE_TOKEN = process.env.INTERNAL_SERVICE_TOKEN;

// Simple internal auth middleware
function internalAuth(req: Request, res: Response, next: Function) {
  if (!INTERNAL_SERVICE_TOKEN) {
    logger.error('[ChatIntegration] INTERNAL_SERVICE_TOKEN env var is not set');
    res.status(503).json({ error: 'Internal service not configured' });
    return;
  }
  const token = req.headers['x-internal-service'] as string;
  if (!token || token !== INTERNAL_SERVICE_TOKEN) {
    res.status(401).json({ error: 'Invalid internal service token' });
    return;
  }
  next();
}

router.post('/from-chat', internalAuth, async (req: Request, res: Response) => {
  try {
    const {
      hotelId,
      guestId,
      guestStayId,
      categorySlug,
      categoryId,
      roomNumber,
      comment,
      chatMessageId,
      items,
    } = req.body;

    if (!hotelId || !guestId) {
      res.status(400).json({ error: 'hotelId and guestId are required' });
      return;
    }

    // Resolve category
    let resolvedCategoryId = categoryId;
    if (!resolvedCategoryId && categorySlug) {
      const cat = await prisma.serviceCategory.findFirst({
        where: { hotelId, slug: categorySlug, isActive: true },
      });
      resolvedCategoryId = cat?.id;
    }

    if (!resolvedCategoryId) {
      // Try to find a default category
      const defaultCat = await prisma.serviceCategory.findFirst({
        where: { hotelId, isActive: true },
        orderBy: { sortOrder: 'asc' },
      });
      resolvedCategoryId = defaultCat?.id;
    }

    if (!resolvedCategoryId) {
      res.status(400).json({ error: 'No service category found for this hotel' });
      return;
    }

    // Create service request
    const sr = await prisma.serviceRequest.create({
      data: {
        hotelId,
        guestId,
        guestStayId: guestStayId || undefined,
        categoryId: resolvedCategoryId,
        roomNumber: roomNumber || undefined,
        comment: comment || undefined,
        source: 'CHAT',
        chatMessageId: chatMessageId || undefined,
        status: 'pending',
      },
      include: {
        category: { select: { name: true, slug: true } },
      },
    });

    // Record creation
    recordStatusChange({
      taskId: sr.id,
      taskType: 'SERVICE_REQUEST',
      hotelId,
      fromStatus: null,
      toStatus: 'pending',
      changedById: guestId,
      changedByType: 'guest',
    }).catch(() => {});

    // Estimate ETA
    const etaMinutes = await estimateETA({
      categoryId: resolvedCategoryId,
      hotelId,
      taskType: 'SERVICE_REQUEST',
    });

    // Update ETA on the request
    await prisma.serviceRequest.update({
      where: { id: sr.id },
      data: { etaMinutes, etaUpdatedAt: new Date() },
    });

    // Auto-assign via task router
    const routeResult = await routeTask({
      hotelId,
      serviceCategoryId: resolvedCategoryId,
      roomNumber: roomNumber || undefined,
    });

    if (routeResult.staffId) {
      await prisma.serviceRequest.update({
        where: { id: sr.id },
        data: {
          assignedStaffId: routeResult.staffId,
          status: 'confirmed',
          assigneeGroupId: routeResult.groupId || undefined,
        },
      });

      recordStatusChange({
        taskId: sr.id,
        taskType: 'SERVICE_REQUEST',
        hotelId,
        fromStatus: 'pending',
        toStatus: 'confirmed',
        changedByType: 'system',
      }).catch(() => {});
    }

    res.status(201).json({
      taskId: sr.id,
      taskType: 'SERVICE_REQUEST',
      title: sr.category?.name || 'Service Request',
      status: routeResult.staffId ? 'confirmed' : 'pending',
      etaMinutes,
      assignedStaffId: routeResult.staffId,
    });
  } catch (err) {
    logger.error(err, '[ChatIntegration] Failed to create task from chat');
    res.status(500).json({ error: 'Failed to create task' });
  }
});

export default router;
