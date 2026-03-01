import { z } from 'zod';

export const appOpenSchema = z.object({
  source: z.enum([
    'widget', 'qr_room', 'qr_lobby', 'qr_restaurant', 'qr_spa',
    'qr_elevator', 'sms_booking', 'organic', 'direct',
  ]),
  hotel_id: z.string().uuid().optional(),
  context_params: z.record(z.unknown()).optional(),
  device_info: z.record(z.unknown()).optional(),
});

export type AppOpenInput = z.infer<typeof appOpenSchema>;
