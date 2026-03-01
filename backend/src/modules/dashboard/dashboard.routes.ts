import { Router } from 'express';
import { dashboardController } from './dashboard.controller';
import {
  authenticateDashboardManager,
  verifyHotelAccess,
} from '../../shared/middleware/dashboardAuth';

const router = Router();

// ── Auth (public) ─────────────────────────────────────────────────────────────
router.post('/auth/login', dashboardController.login);

// ── Protected hotel routes ────────────────────────────────────────────────────
// Apply auth + hotel access check to all /hotels/:hotelId/* routes
router.use(
  '/hotels/:hotelId',
  authenticateDashboardManager,
  verifyHotelAccess,
);

// Overview
router.get('/hotels/:hotelId/overview', dashboardController.overview);

// Guests
router.get('/hotels/:hotelId/guests', dashboardController.guests);

// Orders
router.get('/hotels/:hotelId/orders', dashboardController.orders);
router.get('/hotels/:hotelId/orders/stream', dashboardController.ordersStream);

// QR (read-only)
router.get('/hotels/:hotelId/qr', dashboardController.listQR);
router.get('/hotels/:hotelId/qr/download-all', dashboardController.downloadAllQRZip);
router.get('/hotels/:hotelId/qr/:qrId/pdf', dashboardController.downloadQRPdf);

// Stats
router.get('/hotels/:hotelId/stats', dashboardController.stats);

// SMS Logs
router.get('/hotels/:hotelId/sms-logs', dashboardController.smsLogs);

// Service Requests
router.get('/hotels/:hotelId/service-requests', dashboardController.serviceRequests);
router.put('/hotels/:hotelId/service-requests/:id/status', dashboardController.updateServiceRequestStatus);
router.get('/hotels/:hotelId/service-requests/stream', dashboardController.serviceRequestsStream);
router.get('/hotels/:hotelId/service-stats', dashboardController.serviceStats);

export default router;
