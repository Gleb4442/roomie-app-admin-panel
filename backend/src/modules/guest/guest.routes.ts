import { Router } from 'express';
import { guestController } from './guest.controller';
import { authenticateGuestJWT } from '../../shared/middleware/auth';

const router = Router();

router.post('/register', guestController.register);
router.post('/verify-otp', guestController.verifyOtp);
router.post('/login', guestController.login);
router.post('/refresh', guestController.refresh);
router.get('/me', authenticateGuestJWT, guestController.getMe);
router.put('/me', authenticateGuestJWT, guestController.updateProfile);
router.post('/quick-register', guestController.quickRegister);
router.post('/link-hotel', authenticateGuestJWT, guestController.linkHotel);
router.post('/link-booking', authenticateGuestJWT, guestController.linkBooking);
router.post('/link-chat', authenticateGuestJWT, guestController.linkChat);
router.get('/by-email', authenticateGuestJWT, guestController.findByEmail);
router.post('/push-token', authenticateGuestJWT, guestController.savePushToken);

export default router;
