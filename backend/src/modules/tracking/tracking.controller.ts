import { Request, Response, NextFunction } from 'express';
import { trackingService } from './tracking.service';
import { appOpenSchema } from './tracking.validation';

export const trackingController = {
  async trackAppOpen(req: Request, res: Response, next: NextFunction) {
    try {
      const { source, hotel_id, context_params, device_info } = appOpenSchema.parse(req.body);
      const result = await trackingService.trackAppOpen({
        source,
        hotelId: hotel_id,
        contextParams: context_params,
        deviceInfo: device_info,
      });
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
};
