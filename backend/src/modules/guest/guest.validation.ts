import { z } from 'zod';

const phoneSchema = z
  .string()
  .min(7, 'Phone number is too short')
  .max(20, 'Phone number is too long')
  .regex(/^\+?[0-9\s\-().]+$/, 'Invalid phone number format');

export const registerSchema = z.object({
  phone: phoneSchema,
  firstName: z.string().min(1, 'First name is required').max(100),
});

export const verifyOtpSchema = z.object({
  phone: phoneSchema,
  code: z.string().length(6, 'OTP must be 6 digits').regex(/^\d+$/, 'OTP must be numeric'),
});

export const loginSchema = z.object({
  phone: phoneSchema,
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export const quickRegisterSchema = z.object({
  phone: phoneSchema,
  firstName: z.string().min(1, 'First name is required').max(100),
});

export const linkHotelSchema = z.object({
  hotelId: z.string().uuid(),
  source: z.enum([
    'widget', 'qr_room', 'qr_lobby', 'qr_restaurant', 'qr_spa',
    'qr_elevator', 'sms_booking', 'organic', 'direct',
  ]).optional().default('organic'),
  roomNumber: z.string().optional(),
  contextParams: z.record(z.unknown()).optional(),
});

export const linkBookingSchema = z.object({
  hotelId: z.string().uuid(),
  bookingRef: z.string().min(1, 'Booking reference is required'),
});

export const linkChatSchema = z.object({
  roomieChatId: z.string().min(1, 'Chat ID is required'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type QuickRegisterInput = z.infer<typeof quickRegisterSchema>;
export type LinkHotelInput = z.infer<typeof linkHotelSchema>;
export type LinkBookingInput = z.infer<typeof linkBookingSchema>;
export type LinkChatInput = z.infer<typeof linkChatSchema>;
