import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../shared/types';
import { createOrderSchema, updateOrderStatusSchema } from './order.validation';
import * as orderService from './order.service';
import { prisma } from '../../config/database';

export async function create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const data = createOrderSchema.parse(req.body);
    const order = await orderService.createOrder({
      guestId: req.guest!.id,
      ...data,
    });
    res.status(201).json({ success: true, data: order });
  } catch (err) {
    next(err);
  }
}

export async function list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { hotelId, status } = req.query;
    let orders = await orderService.getGuestOrders(
      req.guest!.id,
      hotelId as string | undefined,
    );
    if (status) {
      orders = orders.filter((o) => o.status === status);
    }
    res.json({ success: true, data: orders });
  } catch (err) {
    next(err);
  }
}

export async function getById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const order = await orderService.getOrderById(req.params.id as string, req.guest!.id);
    if (!order) return res.status(404).json({ success: false, error: 'Order not found' });
    res.json({ success: true, data: order });
  } catch (err) {
    next(err);
  }
}

export async function track(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const tracking = await orderService.getOrderTracking(req.params.id as string, req.guest!.id);
    if (!tracking) return res.status(404).json({ success: false, error: 'Order not found' });
    res.json({ success: true, data: tracking });
  } catch (err) {
    next(err);
  }
}

export async function cancel(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const order = await orderService.cancelOrder(req.params.id as string, req.guest!.id);
    res.json({ success: true, data: order });
  } catch (err) {
    next(err);
  }
}

// Admin endpoints
export async function adminList(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { hotelId, status } = req.query;
    const where: any = {};
    if (hotelId) where.hotelId = hotelId;
    if (status) where.status = status;

    const orders = await prisma.order.findMany({
      where,
      include: { items: { include: { service: true } }, guest: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: orders });
  } catch (err) {
    next(err);
  }
}

export async function adminUpdateStatus(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const data = updateOrderStatusSchema.parse(req.body);
    const updateData: any = { status: data.status };

    if (data.estimatedMinutes) {
      updateData.estimatedAt = new Date(Date.now() + data.estimatedMinutes * 60 * 1000);
    }

    // Set timestamps based on status
    const now = new Date();
    if (data.status === 'CONFIRMED') updateData.confirmedAt = now;
    if (data.status === 'PREPARING') updateData.preparingAt = now;
    if (data.status === 'READY') updateData.readyAt = now;
    if (data.status === 'IN_TRANSIT') updateData.inTransitAt = now;
    if (data.status === 'DELIVERED') updateData.deliveredAt = now;
    if (data.status === 'CANCELLED') updateData.cancelledAt = now;

    const order = await prisma.order.update({
      where: { id: req.params.id as string },
      data: updateData,
      include: { items: { include: { service: true } } },
    });
    res.json({ success: true, data: order });
  } catch (err) {
    next(err);
  }
}
