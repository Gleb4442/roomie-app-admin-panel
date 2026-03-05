import { Request, Response, NextFunction } from 'express';
import { guestService, updateGuestProfile } from './guest.service';
import {
  registerSchema,
  verifyOtpSchema,
  loginSchema,
  refreshTokenSchema,
  quickRegisterSchema,
  linkHotelSchema,
  linkBookingSchema,
  linkChatSchema,
} from './guest.validation';
import { AuthenticatedRequest } from '../../shared/types';

export const guestController = {
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const { phone, firstName } = registerSchema.parse(req.body);
      const result = await guestService.register(phone, firstName);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async verifyOtp(req: Request, res: Response, next: NextFunction) {
    try {
      const { phone, code } = verifyOtpSchema.parse(req.body);
      const result = await guestService.verifyOtp(phone, code);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { phone } = loginSchema.parse(req.body);
      const result = await guestService.login(phone);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async refresh(req: Request, res: Response, next: NextFunction) {
    try {
      const { refreshToken } = refreshTokenSchema.parse(req.body);
      const result = await guestService.refreshToken(refreshToken);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async getMe(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await guestService.getMe(req.guest!.id);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async quickRegister(req: Request, res: Response, next: NextFunction) {
    try {
      const { phone, firstName } = quickRegisterSchema.parse(req.body);
      const result = await guestService.quickRegister(phone, firstName);
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async linkHotel(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = linkHotelSchema.parse(req.body);
      const result = await guestService.linkHotel(req.guest!.id, data);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async linkBooking(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { hotelId, bookingRef } = linkBookingSchema.parse(req.body);
      const result = await guestService.linkBooking(req.guest!.id, hotelId, bookingRef);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async linkChat(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { roomieChatId } = linkChatSchema.parse(req.body);
      const result = await guestService.linkChat(req.guest!.id, roomieChatId);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async findByEmail(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const email = req.query.email as string;
      if (!email) {
        return res.status(400).json({ success: false, error: 'email query parameter is required' });
      }
      const result = await guestService.findByEmail(email);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async updateProfile(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const guestId = req.guest!.id;
      const { firstName, lastName, phone } = req.body;
      const result = await updateGuestProfile(guestId, { firstName, lastName, phone });
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async savePushToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const guestId = req.guest!.id;
      const { expoPushToken } = req.body;
      if (!expoPushToken) {
        return res.status(400).json({ success: false, error: 'expoPushToken is required' });
      }
      const { prisma } = require('../../config/database');
      await prisma.guestAccount.update({
        where: { id: guestId },
        data: { expoPushToken },
      });
      res.status(200).json({ success: true });
    } catch (err) {
      next(err);
    }
  },
};
