import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../shared/types';
import { taskCatalogService, taskRequestService } from './taskService';

export const taskController = {
  // ── Catalog ─────────────────────────────────────────────────────────────────
  async getCategories(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const hotelId = req.params.hotelId as string;
      const lang = req.query.lang as string | undefined;
      const data = await taskCatalogService.getCategories(hotelId, lang);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },

  async getCategory(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const categoryId = req.params.categoryId as string;
      const lang = req.query.lang as string | undefined;
      const data = await taskCatalogService.getCategory(categoryId, lang);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },

  // ── Guest Requests ──────────────────────────────────────────────────────────
  async createRequest(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const hotelId = req.params.hotelId as string;
      const guestId = req.guest!.id;
      const { categoryId, items, roomNumber, comment, requestedTime, guestStayId } = req.body;

      const data = await taskRequestService.createRequest({
        hotelId,
        guestId,
        guestStayId,
        categoryId,
        items,
        roomNumber,
        comment,
        requestedTime: requestedTime ? new Date(requestedTime) : undefined,
      });

      res.status(201).json({ success: true, data });
    } catch (err) { next(err); }
  },

  async getMyRequests(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const guestId = req.guest!.id;
      const guestStayId = req.query.guestStayId as string | undefined;
      const data = await taskRequestService.getGuestRequests(guestId, guestStayId);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },

  async cancelRequest(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const guestId = req.guest!.id;
      const requestId = req.params.requestId as string;
      const data = await taskRequestService.cancelRequest(requestId, guestId);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },
};
