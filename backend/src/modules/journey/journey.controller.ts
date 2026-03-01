import { Response, NextFunction } from 'express';
import { journeyService } from './journey.service';
import { currentStayQuerySchema, updateStageSchema } from './journey.validation';
import { AuthenticatedRequest } from '../../shared/types';

export const journeyController = {
  async getCurrentStay(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { hotelId } = currentStayQuerySchema.parse(req.query);
      const result = await journeyService.getCurrentStay(req.guest!.id, hotelId);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async updateStage(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { stayId, stage, roomNumber } = updateStageSchema.parse(req.body);
      const result = await journeyService.updateStage(stayId, req.guest!.id, stage, roomNumber);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
};
