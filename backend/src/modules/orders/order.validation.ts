import { z } from 'zod';

export const createOrderSchema = z.object({
  hotelId: z.string().uuid(),
  type: z.enum(['FOOD', 'HOUSEKEEPING', 'SPA', 'TRANSPORT']),
  items: z.array(
    z.object({
      serviceId: z.string().uuid(),
      quantity: z.number().int().min(1).default(1),
      modifiers: z.array(z.any()).optional(),
      notes: z.string().optional(),
    }),
  ).min(1),
  roomNumber: z.string().optional(),
  specialInstructions: z.string().optional(),
  deliveryTime: z.string().optional(),
});

export const updateOrderStatusSchema = z.object({
  status: z.enum([
    'PENDING', 'SENT_TO_POS', 'CONFIRMED', 'PREPARING',
    'READY', 'IN_TRANSIT', 'DELIVERED', 'COMPLETED', 'CANCELLED',
  ]),
  estimatedMinutes: z.number().optional(),
});
