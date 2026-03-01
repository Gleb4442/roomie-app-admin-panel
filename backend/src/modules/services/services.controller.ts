import { Request, Response, NextFunction } from 'express';
import { getHotelServices, getServiceById } from './services.service';

export async function listServices(req: Request, res: Response, next: NextFunction) {
  try {
    const hotelId = req.params.hotelId as string;
    const category = req.query.category as string | undefined;
    const result = await getHotelServices(hotelId, category);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function getService(req: Request, res: Response, next: NextFunction) {
  try {
    const service = await getServiceById(req.params.id as string);
    if (!service) {
      return res.status(404).json({ success: false, error: 'Service not found' });
    }
    res.json({ success: true, data: service });
  } catch (err) {
    next(err);
  }
}
