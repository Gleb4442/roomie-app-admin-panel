import { Router } from 'express';
import { adminController } from './admin.controller';
import { authenticateHotelMolAdmin } from '../../shared/middleware/adminAuth';

const router = Router();

// ── Auth (public) ─────────────────────────────────────────────────────────────
router.post('/auth/login', adminController.login);

// Apply admin auth to all routes below
router.use(authenticateHotelMolAdmin);

// ── Hotels ────────────────────────────────────────────────────────────────────
router.get('/hotels', adminController.listHotels);
router.post('/hotels', adminController.createHotel);
router.get('/hotels/:hotelId', adminController.getHotel);
router.put('/hotels/:hotelId', adminController.updateHotel);
router.delete('/hotels/:hotelId', adminController.deleteHotel);

// Branding
router.put('/hotels/:hotelId/branding', adminController.updateBranding);
router.post('/hotels/:hotelId/branding/logo', ...adminController.uploadLogo);

// ── PMS ───────────────────────────────────────────────────────────────────────
router.get('/hotels/:hotelId/pms', adminController.getPmsConfig);
router.post('/hotels/:hotelId/pms', adminController.upsertPmsConfig);
router.put('/hotels/:hotelId/pms', adminController.upsertPmsConfig);
router.delete('/hotels/:hotelId/pms', adminController.deletePmsConfig);
router.post('/hotels/:hotelId/pms/test', adminController.testPmsConnection);
router.post('/hotels/:hotelId/pms/sync', adminController.syncPms);
router.get('/hotels/:hotelId/pms/sync-logs', adminController.getPmsSyncLogs);

// ── SMS ───────────────────────────────────────────────────────────────────────
router.get('/hotels/:hotelId/sms', adminController.getSmsConfig);
router.post('/hotels/:hotelId/sms', adminController.upsertSmsConfig);
router.put('/hotels/:hotelId/sms', adminController.upsertSmsConfig);
router.delete('/hotels/:hotelId/sms', adminController.deleteSmsConfig);
router.post('/hotels/:hotelId/sms/test', adminController.testSms);

// ── POS ───────────────────────────────────────────────────────────────────────
router.get('/hotels/:hotelId/pos', adminController.getPosConfig);
router.put('/hotels/:hotelId/pos', adminController.upsertPosConfig);
router.post('/hotels/:hotelId/pos/test', adminController.testPosConnection);
router.post('/hotels/:hotelId/pos/sync-menu', adminController.syncPosMenu);

// ── QR ────────────────────────────────────────────────────────────────────────
router.get('/hotels/:hotelId/qr', adminController.listQR);
router.post('/hotels/:hotelId/qr/generate', adminController.generateQR);
router.post('/hotels/:hotelId/qr/generate-bulk', adminController.generateQRBulk);
router.post('/hotels/:hotelId/qr/regenerate', adminController.regenerateAllQR);
router.delete('/hotels/:hotelId/qr/:qrId', adminController.deleteQR);

// ── Service Categories ────────────────────────────────────────────────────────
router.get('/hotels/:hotelId/service-categories', adminController.listServiceCategories);
router.post('/hotels/:hotelId/service-categories', adminController.createServiceCategory);
router.put('/hotels/:hotelId/service-categories/:id', adminController.updateServiceCategory);
router.delete('/hotels/:hotelId/service-categories/:id', adminController.deleteServiceCategory);
router.post('/hotels/:hotelId/service-categories/seed', adminController.seedServiceCategories);

// Service Items
router.post('/hotels/:hotelId/service-categories/:catId/items', adminController.createServiceItem);
router.put('/hotels/:hotelId/service-categories/:catId/items/:id', adminController.updateServiceItem);
router.delete('/hotels/:hotelId/service-categories/:catId/items/:id', adminController.deleteServiceItem);

// ── TMS ──────────────────────────────────────────────────────────────────────
router.get('/hotels/:hotelId/tms', adminController.getTmsConfig);
router.post('/hotels/:hotelId/tms', adminController.upsertTmsConfig);
router.put('/hotels/:hotelId/tms', adminController.upsertTmsConfig);
router.delete('/hotels/:hotelId/tms', adminController.deleteTmsConfig);
router.post('/hotels/:hotelId/tms/test', adminController.testTmsConnection);
router.put('/hotels/:hotelId/tms/mapping', adminController.updateTmsMapping);

// ── Staff ─────────────────────────────────────────────────────────────────────
router.get('/hotels/:hotelId/staff', adminController.listStaff);
router.post('/hotels/:hotelId/staff', adminController.createStaff);
router.patch('/hotels/:hotelId/staff/:staffId', adminController.updateStaff);
router.delete('/hotels/:hotelId/staff/:staffId', adminController.deactivateStaff);
router.post('/hotels/:hotelId/staff/:staffId/reset-pin', adminController.resetStaffPin);

// ── Housekeeping ──────────────────────────────────────────────────────────────
router.get('/hotels/:hotelId/rooms', adminController.listRooms);
router.post('/hotels/:hotelId/rooms/bulk', adminController.bulkCreateRooms);
router.patch('/hotels/:hotelId/rooms/:roomId/status', adminController.updateRoomStatus);
router.delete('/hotels/:hotelId/rooms/:roomId', adminController.deleteRoom);

// ── Tasks ─────────────────────────────────────────────────────────────────────
router.get('/hotels/:hotelId/tasks', adminController.listTasks);
router.patch('/hotels/:hotelId/tasks/:taskType/:taskId/status', adminController.updateAdminTaskStatus);

// ── Task Templates ────────────────────────────────────────────────────────────
router.get('/hotels/:hotelId/templates', adminController.listTemplates);
router.post('/hotels/:hotelId/templates', adminController.createTemplate);
router.patch('/hotels/:hotelId/templates/:templateId', adminController.updateTemplate);
router.delete('/hotels/:hotelId/templates/:templateId', adminController.deactivateTemplate);

// ── TMS Stats ─────────────────────────────────────────────────────────────────
router.get('/hotels/:hotelId/tms/stats', adminController.getTmsStats);

// ── Monitoring ────────────────────────────────────────────────────────────────
router.get('/monitoring/overview', adminController.monitoringOverview);
router.get('/monitoring/sms-errors', adminController.monitoringSmsErrors);

// ── Managers ──────────────────────────────────────────────────────────────────
router.get('/managers', adminController.listManagers);
router.post('/managers', adminController.createManager);
router.put('/managers/:managerId', adminController.updateManager);
router.delete('/managers/:managerId', adminController.deleteManager);
router.post('/managers/:managerId/hotels', adminController.linkManagerHotels);

export default router;
