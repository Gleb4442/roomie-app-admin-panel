import { Request, Response, NextFunction } from 'express';
import { hotelService } from './hotel.service';

export const hotelController = {
  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const hotel = await hotelService.getById(id);
      res.status(200).json({ success: true, data: hotel });
    } catch (err) {
      next(err);
    }
  },
};
