import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import {
  adminAuthService,
  adminHotelService,
  adminPmsService,
  adminSmsService,
  adminPosService,
  adminMonitoringService,
  adminManagerService,
  adminServiceCategoryService,
  adminTmsService,
} from './admin.service';
import { qrService } from '../qr/qrService';
import { env } from '../../config/environment';
import { listStaffMembers, createStaffMember, getUnifiedTasks, updateTaskStatus, listTemplatesForDashboard, createTemplateWithItems, updateTemplateWithItems, deactivateTemplate, getTMSStats } from '../staff/staff.service';
import { roomService } from '../housekeeping/room.service';
import { prisma } from '../../config/database';
import bcrypt from 'bcryptjs';
import { AppError } from '../../shared/middleware/errorHandler';
import { HousekeepingStatus } from '@prisma/client';

const upload = multer({ dest: path.join(process.cwd(), env.uploadsDir, 'logos') });

export const adminController = {
  // ── Auth ─────────────────────────────────────────────────────────────────
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { username, password } = req.body;
      const result = adminAuthService.login(username, password);
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  },

  // ── Hotels ────────────────────────────────────────────────────────────────
  async listHotels(_req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ success: true, data: await adminHotelService.list() });
    } catch (err) { next(err); }
  },

  async getHotel(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ success: true, data: await adminHotelService.get(req.params.hotelId as string) });
    } catch (err) { next(err); }
  },

  async createHotel(req: Request, res: Response, next: NextFunction) {
    try {
      const hotel = await adminHotelService.create(req.body);
      res.status(201).json({ success: true, data: hotel });
    } catch (err) { next(err); }
  },

  async updateHotel(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ success: true, data: await adminHotelService.update(req.params.hotelId as string, req.body) });
    } catch (err) { next(err); }
  },

  async deleteHotel(req: Request, res: Response, next: NextFunction) {
    try {
      await adminHotelService.delete(req.params.hotelId as string);
      res.json({ success: true, message: 'Hotel deleted' });
    } catch (err) { next(err); }
  },

  async updateBranding(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ success: true, data: await adminHotelService.updateBranding(req.params.hotelId as string, req.body) });
    } catch (err) { next(err); }
  },

  uploadLogo: [
    upload.single('logo'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded' });
        const logoUrl = `/uploads/logos/${req.file.filename}`;
        const hotel = await adminHotelService.updateBranding(req.params.hotelId as string, { imageUrl: logoUrl });
        res.json({ success: true, data: { logoUrl, hotel } });
      } catch (err) { next(err); }
    },
  ],

  // ── PMS ───────────────────────────────────────────────────────────────────
  async getPmsConfig(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ success: true, data: await adminPmsService.get(req.params.hotelId as string) });
    } catch (err) { next(err); }
  },

  async upsertPmsConfig(req: Request, res: Response, next: NextFunction) {
    try {
      const cfg = await adminPmsService.upsert(req.params.hotelId as string, req.body);
      res.json({ success: true, data: { ...cfg, credentials: '[REDACTED]' } });
    } catch (err) { next(err); }
  },

  async deletePmsConfig(req: Request, res: Response, next: NextFunction) {
    try {
      await adminPmsService.disable(req.params.hotelId as string);
      res.json({ success: true, message: 'PMS disabled' });
    } catch (err) { next(err); }
  },

  async testPmsConnection(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ success: true, data: await adminPmsService.testConnection(req.params.hotelId as string) });
    } catch (err) { next(err); }
  },

  async syncPms(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ success: true, data: await adminPmsService.manualSync(req.params.hotelId as string) });
    } catch (err) { next(err); }
  },

  async getPmsSyncLogs(req: Request, res: Response, next: NextFunction) {
    try {
      const limit = parseInt(req.query.limit as string || '50', 10);
      res.json({ success: true, data: await adminPmsService.getSyncLogs(req.params.hotelId as string, limit) });
    } catch (err) { next(err); }
  },

  // ── SMS ───────────────────────────────────────────────────────────────────
  async getSmsConfig(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ success: true, data: await adminSmsService.get(req.params.hotelId as string) });
    } catch (err) { next(err); }
  },

  async upsertSmsConfig(req: Request, res: Response, next: NextFunction) {
    try {
      const cfg = await adminSmsService.upsert(req.params.hotelId as string, req.body);
      res.json({ success: true, data: { ...cfg, credentials: '[REDACTED]' } });
    } catch (err) { next(err); }
  },

  async deleteSmsConfig(req: Request, res: Response, next: NextFunction) {
    try {
      await adminSmsService.disable(req.params.hotelId as string);
      res.json({ success: true, message: 'SMS disabled' });
    } catch (err) { next(err); }
  },

  async testSms(req: Request, res: Response, next: NextFunction) {
    try {
      const { phone } = req.body;
      res.json({ success: true, data: await adminSmsService.sendTest(req.params.hotelId as string, phone) });
    } catch (err) { next(err); }
  },

  // ── POS ───────────────────────────────────────────────────────────────────
  async getPosConfig(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ success: true, data: await adminPosService.get(req.params.hotelId as string) });
    } catch (err) { next(err); }
  },

  async upsertPosConfig(req: Request, res: Response, next: NextFunction) {
    try {
      const cfg = await adminPosService.upsert(req.params.hotelId as string, req.body);
      res.json({ success: true, data: { ...cfg, accessToken: '[REDACTED]' } });
    } catch (err) { next(err); }
  },

  async testPosConnection(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ success: true, data: await adminPosService.testConnection(req.params.hotelId as string) });
    } catch (err) { next(err); }
  },

  async syncPosMenu(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ success: true, data: await adminPosService.syncMenu(req.params.hotelId as string) });
    } catch (err) { next(err); }
  },

  // ── QR ────────────────────────────────────────────────────────────────────
  async generateQR(req: Request, res: Response, next: NextFunction) {
    try {
      const { roomNumber, label } = req.body;
      const qr = await qrService.generateForRoom(req.params.hotelId as string, roomNumber, label);
      res.status(201).json({ success: true, data: qr });
    } catch (err) { next(err); }
  },

  async generateQRBulk(req: Request, res: Response, next: NextFunction) {
    try {
      const { rooms } = req.body;
      const result = await qrService.generateBulk(req.params.hotelId as string, rooms);
      res.status(201).json({ success: true, data: result });
    } catch (err) { next(err); }
  },

  async regenerateAllQR(req: Request, res: Response, next: NextFunction) {
    try {
      await qrService.regenerateForHotel(req.params.hotelId as string);
      res.json({ success: true, message: 'QR codes regenerated' });
    } catch (err) { next(err); }
  },

  async listQR(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ success: true, data: await qrService.getByHotel(req.params.hotelId as string) });
    } catch (err) { next(err); }
  },

  async deleteQR(req: Request, res: Response, next: NextFunction) {
    try {
      await qrService.delete(req.params.qrId as string);
      res.json({ success: true, message: 'QR deleted' });
    } catch (err) { next(err); }
  },

  // ── Monitoring ────────────────────────────────────────────────────────────
  async monitoringOverview(_req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ success: true, data: await adminMonitoringService.overview() });
    } catch (err) { next(err); }
  },

  async monitoringSmsErrors(req: Request, res: Response, next: NextFunction) {
    try {
      const limit = parseInt(req.query.limit as string || '50', 10);
      res.json({ success: true, data: await adminMonitoringService.smsErrors(limit) });
    } catch (err) { next(err); }
  },

  // ── Managers ──────────────────────────────────────────────────────────────
  async listManagers(_req: Request, res: Response, next: NextFunction) {
    try {
      const managers = await adminManagerService.list();
      const sanitized = managers.map(({ passwordHash: _, ...m }) => m);
      res.json({ success: true, data: sanitized });
    } catch (err) { next(err); }
  },

  async createManager(req: Request, res: Response, next: NextFunction) {
    try {
      const { username, password, role } = req.body;
      const manager = await adminManagerService.create({ username, password, role });
      const { passwordHash: _, ...safe } = manager;
      res.status(201).json({ success: true, data: safe });
    } catch (err) { next(err); }
  },

  async updateManager(req: Request, res: Response, next: NextFunction) {
    try {
      const manager = await adminManagerService.update(req.params.managerId as string, req.body);
      const { passwordHash: _, ...safe } = manager;
      res.json({ success: true, data: safe });
    } catch (err) { next(err); }
  },

  async deleteManager(req: Request, res: Response, next: NextFunction) {
    try {
      await adminManagerService.delete(req.params.managerId as string);
      res.json({ success: true, message: 'Manager deleted' });
    } catch (err) { next(err); }
  },

  async linkManagerHotels(req: Request, res: Response, next: NextFunction) {
    try {
      const { hotelIds } = req.body;
      const manager = await adminManagerService.linkHotels(req.params.managerId as string, hotelIds);
      const { passwordHash: _, ...safe } = manager;
      res.json({ success: true, data: safe });
    } catch (err) { next(err); }
  },

  // ── Staff ─────────────────────────────────────────────────────────────────
  async listStaff(req: Request, res: Response, next: NextFunction) {
    try {
      const staff = await listStaffMembers(req.params.hotelId as string);
      res.json({ success: true, data: staff });
    } catch (err) { next(err); }
  },

  async createStaff(req: Request, res: Response, next: NextFunction) {
    try {
      const member = await createStaffMember({ hotelId: req.params.hotelId as string, ...req.body });
      res.status(201).json({ success: true, data: member });
    } catch (err) { next(err); }
  },

  async updateStaff(req: Request, res: Response, next: NextFunction) {
    try {
      const { staffId, hotelId } = req.params as { staffId: string; hotelId: string };
      const existing = await prisma.staffMember.findFirst({ where: { id: staffId, hotelId } });
      if (!existing) throw new AppError(404, 'Staff member not found');
      const updates: Record<string, unknown> = { ...req.body };
      if (updates.password) {
        updates.passwordHash = await bcrypt.hash(updates.password as string, 10);
        delete updates.password;
      }
      const member = await prisma.staffMember.update({
        where: { id: staffId },
        data: updates,
        select: {
          id: true, email: true, firstName: true, lastName: true, phone: true,
          role: true, department: true, isActive: true, assignedFloor: true,
        },
      });
      res.json({ success: true, data: member });
    } catch (err) { next(err); }
  },

  async deactivateStaff(req: Request, res: Response, next: NextFunction) {
    try {
      const { staffId, hotelId } = req.params as { staffId: string; hotelId: string };
      const existing = await prisma.staffMember.findFirst({ where: { id: staffId, hotelId } });
      if (!existing) throw new AppError(404, 'Staff member not found');
      await prisma.staffMember.update({ where: { id: staffId }, data: { isActive: false } });
      res.json({ success: true, message: 'Staff member deactivated' });
    } catch (err) { next(err); }
  },

  async resetStaffPin(req: Request, res: Response, next: NextFunction) {
    try {
      const { staffId, hotelId } = req.params as { staffId: string; hotelId: string };
      const pin: string = req.body.pin;
      if (!pin || pin.length < 4) throw new AppError(400, 'PIN must be at least 4 digits');
      const existing = await prisma.staffMember.findFirst({ where: { id: staffId, hotelId } });
      if (!existing) throw new AppError(404, 'Staff member not found');
      const pinHash = await bcrypt.hash(pin, 10);
      await prisma.staffMember.update({ where: { id: staffId }, data: { pin: pinHash } });
      res.json({ success: true, message: 'PIN updated' });
    } catch (err) { next(err); }
  },

  // ── Service Categories ──────────────────────────────────────────────────────
  async listServiceCategories(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ success: true, data: await adminServiceCategoryService.list(req.params.hotelId as string) });
    } catch (err) { next(err); }
  },

  async createServiceCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const cat = await adminServiceCategoryService.create(req.params.hotelId as string, req.body);
      res.status(201).json({ success: true, data: cat });
    } catch (err) { next(err); }
  },

  async updateServiceCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const cat = await adminServiceCategoryService.update(req.params.id as string, req.body);
      res.json({ success: true, data: cat });
    } catch (err) { next(err); }
  },

  async deleteServiceCategory(req: Request, res: Response, next: NextFunction) {
    try {
      await adminServiceCategoryService.delete(req.params.id as string);
      res.json({ success: true, message: 'Category deleted' });
    } catch (err) { next(err); }
  },

  async seedServiceCategories(req: Request, res: Response, next: NextFunction) {
    try {
      const count = await adminServiceCategoryService.seed(req.params.hotelId as string);
      res.json({ success: true, data: { seeded: count } });
    } catch (err) { next(err); }
  },

  // ── Service Items ───────────────────────────────────────────────────────────
  async createServiceItem(req: Request, res: Response, next: NextFunction) {
    try {
      const item = await adminServiceCategoryService.createItem(req.params.catId as string, req.body);
      res.status(201).json({ success: true, data: item });
    } catch (err) { next(err); }
  },

  async updateServiceItem(req: Request, res: Response, next: NextFunction) {
    try {
      const item = await adminServiceCategoryService.updateItem(req.params.id as string, req.body);
      res.json({ success: true, data: item });
    } catch (err) { next(err); }
  },

  async deleteServiceItem(req: Request, res: Response, next: NextFunction) {
    try {
      await adminServiceCategoryService.deleteItem(req.params.id as string);
      res.json({ success: true, message: 'Item deleted' });
    } catch (err) { next(err); }
  },

  // ── TMS ─────────────────────────────────────────────────────────────────────
  async getTmsConfig(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ success: true, data: await adminTmsService.get(req.params.hotelId as string) });
    } catch (err) { next(err); }
  },

  async upsertTmsConfig(req: Request, res: Response, next: NextFunction) {
    try {
      const cfg = await adminTmsService.upsert(req.params.hotelId as string, req.body);
      res.json({ success: true, data: { ...cfg, credentials: '[REDACTED]' } });
    } catch (err) { next(err); }
  },

  async deleteTmsConfig(req: Request, res: Response, next: NextFunction) {
    try {
      await adminTmsService.disable(req.params.hotelId as string);
      res.json({ success: true, message: 'TMS disabled' });
    } catch (err) { next(err); }
  },

  async testTmsConnection(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ success: true, data: await adminTmsService.testConnection(req.params.hotelId as string) });
    } catch (err) { next(err); }
  },

  async updateTmsMapping(req: Request, res: Response, next: NextFunction) {
    try {
      const cfg = await adminTmsService.updateMapping(req.params.hotelId as string, req.body.mapping);
      res.json({ success: true, data: cfg });
    } catch (err) { next(err); }
  },

  // ── Housekeeping ─────────────────────────────────────────────────────────────
  async listRooms(req: Request, res: Response, next: NextFunction) {
    try {
      const hotelId = req.params.hotelId as string;
      const rooms = await roomService.listRooms(hotelId);
      res.json({ success: true, data: rooms });
    } catch (err) { next(err); }
  },

  async bulkCreateRooms(req: Request, res: Response, next: NextFunction) {
    try {
      const hotelId = req.params.hotelId as string;
      const { rooms } = req.body;
      if (!Array.isArray(rooms) || rooms.length === 0) throw new AppError(400, 'rooms array required');
      const created = await roomService.bulkCreate(hotelId, rooms);
      res.json({ success: true, data: created, created: created.length });
    } catch (err) { next(err); }
  },

  async updateRoomStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { hotelId, roomId } = req.params as { hotelId: string; roomId: string };
      const { status, notes } = req.body;
      if (!status) throw new AppError(400, 'status required');
      const room = await roomService.getRoomDetail(hotelId, roomId);
      if (!room) throw new AppError(404, 'Room not found');
      const updated = await roomService.updateHousekeepingStatus(roomId, status as HousekeepingStatus, { source: 'DASHBOARD', notes });
      res.json({ success: true, data: updated });
    } catch (err) { next(err); }
  },

  async deleteRoom(req: Request, res: Response, next: NextFunction) {
    try {
      const { hotelId, roomId } = req.params as { hotelId: string; roomId: string };
      const room = await roomService.getRoomDetail(hotelId, roomId);
      if (!room) throw new AppError(404, 'Room not found');
      await prisma.room.update({ where: { id: roomId }, data: { isActive: false } });
      res.json({ success: true, message: 'Room removed' });
    } catch (err) { next(err); }
  },

  // ── Tasks ────────────────────────────────────────────────────────────────────
  async listTasks(req: Request, res: Response, next: NextFunction) {
    try {
      const hotelId = req.params.hotelId as string;
      const tasks = await getUnifiedTasks(hotelId, { role: 'GENERAL_MANAGER', department: 'MANAGEMENT' });
      res.json({ success: true, data: tasks });
    } catch (err) { next(err); }
  },

  async updateAdminTaskStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { taskType, taskId } = req.params as { taskType: string; taskId: string };
      const { status } = req.body;
      if (!status) throw new AppError(400, 'status required');
      const upperType = taskType.toUpperCase() as 'INTERNAL' | 'ORDER' | 'SERVICE_REQUEST';
      await updateTaskStatus(upperType, taskId, status, '');
      res.json({ success: true, message: 'Status updated' });
    } catch (err) { next(err); }
  },

  // ── Task Templates ────────────────────────────────────────────────────────────
  async listTemplates(req: Request, res: Response, next: NextFunction) {
    try {
      const templates = await listTemplatesForDashboard(req.params.hotelId as string);
      res.json({ success: true, data: templates });
    } catch (err) { next(err); }
  },

  async createTemplate(req: Request, res: Response, next: NextFunction) {
    try {
      const hotelId = req.params.hotelId as string;
      const template = await createTemplateWithItems({ hotelId, ...req.body });
      res.status(201).json({ success: true, data: template });
    } catch (err) { next(err); }
  },

  async updateTemplate(req: Request, res: Response, next: NextFunction) {
    try {
      const { hotelId, templateId } = req.params as { hotelId: string; templateId: string };
      const template = await updateTemplateWithItems(templateId, hotelId, req.body);
      res.json({ success: true, data: template });
    } catch (err) { next(err); }
  },

  async deactivateTemplate(req: Request, res: Response, next: NextFunction) {
    try {
      const { hotelId, templateId } = req.params as { hotelId: string; templateId: string };
      await deactivateTemplate(templateId, hotelId);
      res.json({ success: true, message: 'Template deactivated' });
    } catch (err) { next(err); }
  },

  // ── TMS Stats ─────────────────────────────────────────────────────────────────
  async getTmsStats(req: Request, res: Response, next: NextFunction) {
    try {
      const stats = await getTMSStats(req.params.hotelId as string);
      res.json({ success: true, data: stats });
    } catch (err) { next(err); }
  },
};
