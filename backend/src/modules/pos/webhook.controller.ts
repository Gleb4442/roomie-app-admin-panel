import { Request, Response } from 'express';
import { prisma } from '../../config/database';
import { POSFactory } from './POSFactory';
import { logger } from '../../shared/utils/logger';

export async function handlePosterWebhook(req: Request, res: Response) {
  const payload = req.body;

  // Always respond 200 (Poster retries up to 15 times)
  res.status(200).json({ ok: true });

  try {
    const { object, object_id, action } = payload;

    // incoming_order changed → order accepted or cancelled
    if (object === 'incoming_order' && action === 'changed') {
      const order = await prisma.order.findFirst({
        where: { posOrderId: String(object_id) },
      });
      if (!order) return;

      const posConfig = await prisma.hotelPOSConfig.findUnique({
        where: { hotelId: order.hotelId },
      });
      const adapter = POSFactory.createAdapter(posConfig);
      if (!adapter) return;

      const posStatus = await adapter.getOrderStatus(String(object_id));

      if (posStatus.status === 1 && order.status === 'SENT_TO_POS') {
        await prisma.order.update({
          where: { id: order.id },
          data: {
            status: 'CONFIRMED',
            posStatus: '1',
            confirmedAt: new Date(),
          },
        });
      }

      if (posStatus.status === 7) {
        await prisma.order.update({
          where: { id: order.id },
          data: {
            status: 'CANCELLED',
            posStatus: '7',
            cancelledAt: new Date(),
          },
        });
      }
    }

    // transaction added → order closed
    if (object === 'transaction' && action === 'added') {
      const order = await prisma.order.findFirst({
        where: {
          posTransactionId: null,
          status: { in: ['CONFIRMED', 'PREPARING', 'READY', 'IN_TRANSIT'] },
          posOrderId: { not: null },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (order) {
        const posConfig = await prisma.hotelPOSConfig.findUnique({
          where: { hotelId: order.hotelId },
        });
        const adapter = POSFactory.createAdapter(posConfig);
        if (adapter) {
          const posStatus = await adapter.getOrderStatus(order.posOrderId!);
          if (posStatus.transactionId === String(object_id)) {
            await prisma.order.update({
              where: { id: order.id },
              data: {
                status: 'DELIVERED',
                posTransactionId: String(object_id),
                deliveredAt: new Date(),
              },
            });
          }
        }
      }
    }
  } catch (err) {
    logger.error(err, '[Webhook] Error processing Poster webhook');
  }
}
