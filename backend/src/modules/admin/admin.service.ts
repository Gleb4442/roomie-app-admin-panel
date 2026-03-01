import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../config/database';
import { env } from '../../config/environment';
import { AppError } from '../../shared/middleware/errorHandler';
import { PMSFactory } from '../pms/PMSFactory';
import { SMSFactory } from '../sms/SMSFactory';
import { smsService } from '../sms/smsService';
import { seedDefaultCategories } from '../task/defaultCategories';
import { tmsConnector } from '../task/tmsConnector';
import { logger } from '../../shared/utils/logger';

// ── Admin Auth ────────────────────────────────────────────────────────────────

export const adminAuthService = {
  login(username: string, password: string): { token: string } {
    if (username !== env.adminUsername || password !== env.adminPassword) {
      throw new AppError(401, 'Invalid credentials');
    }
    const token = jwt.sign(
      { id: 'admin', username },
      env.adminJwtSecret,
      { expiresIn: '24h' },
    );
    return { token };
  },
};

// ── Hotels ────────────────────────────────────────────────────────────────────

export const adminHotelService = {
  async list() {
    return prisma.hotel.findMany({
      include: {
        pmsConfig: { select: { pmsType: true, isActive: true, lastSyncAt: true, syncMode: true } },
        smsConfig: { select: { provider: true, enabled: true } },
        posConfig: { select: { posType: true, syncEnabled: true } },
        _count: { select: { qrCodes: true, stays: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  async get(hotelId: string) {
    return prisma.hotel.findUniqueOrThrow({
      where: { id: hotelId },
      include: {
        pmsConfig: true,
        smsConfig: true,
        posConfig: true,
        _count: { select: { qrCodes: true, stays: true, guestLinks: true } },
      },
    });
  },

  async create(data: {
    name: string;
    slug: string;
    location?: string;
    description?: string;
    accentColor?: string;
    imageUrl?: string;
    contactEmail?: string;
    contactPhone?: string;
    timezone?: string;
    settings?: object;
  }) {
    return prisma.hotel.create({ data });
  },

  async update(hotelId: string, data: Partial<{
    name: string;
    slug: string;
    location: string;
    description: string;
    accentColor: string;
    imageUrl: string;
    contactEmail: string;
    contactPhone: string;
    timezone: string;
    settings: object;
  }>) {
    return prisma.hotel.update({ where: { id: hotelId }, data });
  },

  async delete(hotelId: string) {
    return prisma.hotel.delete({ where: { id: hotelId } });
  },

  async updateBranding(hotelId: string, data: {
    accentColor?: string;
    imageUrl?: string;
    theme?: object;
  }) {
    return prisma.hotel.update({ where: { id: hotelId }, data });
  },
};

// ── PMS Config ────────────────────────────────────────────────────────────────

export const adminPmsService = {
  async get(hotelId: string) {
    const cfg = await prisma.hotelPMSConfig.findUnique({ where: { hotelId } });
    if (!cfg) throw new AppError(404, 'PMS not configured for this hotel');
    // Mask credentials
    return { ...cfg, credentials: '[REDACTED]' };
  },

  async upsert(hotelId: string, data: {
    pmsType: string;
    credentials: object;
    pmsHotelId?: string;
    syncMode?: string;
    syncIntervalMinutes?: number;
    preCheckinUrl?: string;
  }) {
    return prisma.hotelPMSConfig.upsert({
      where: { hotelId },
      create: { hotelId, ...data, isActive: true },
      update: { ...data, isActive: true },
    });
  },

  async disable(hotelId: string) {
    await prisma.hotelPMSConfig.update({
      where: { hotelId },
      data: { isActive: false, syncMode: 'DISABLED' },
    });
  },

  async testConnection(hotelId: string): Promise<{ success: boolean; message: string }> {
    const cfg = await prisma.hotelPMSConfig.findUnique({ where: { hotelId } });
    if (!cfg || !cfg.isActive) throw new AppError(404, 'PMS not configured');

    try {
      const adapter = PMSFactory.create(cfg);
      const result = await adapter.testConnection();
      return { success: result.ok, message: result.error || 'Connection successful' };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Connection failed';
      return { success: false, message };
    }
  },

  async manualSync(hotelId: string) {
    const { pmsSyncService } = await import('../pms/pmsSyncService');
    await pmsSyncService.syncHotel(hotelId);
    return { triggered: true };
  },

  async getSyncLogs(hotelId: string, limit = 50) {
    // Use stage transitions as proxy for sync log info
    const stays = await prisma.guestStay.findMany({
      where: { hotelId, pmsProvider: { not: null } },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      select: {
        id: true, bookingRef: true, pmsProvider: true, stage: true,
        createdAt: true, updatedAt: true,
        guest: { select: { firstName: true, email: true } },
      },
    });

    const cfg = await prisma.hotelPMSConfig.findUnique({
      where: { hotelId },
      select: { lastSyncAt: true, syncMode: true, pmsType: true },
    });

    return { lastSyncAt: cfg?.lastSyncAt, syncMode: cfg?.syncMode, pmsType: cfg?.pmsType, recentStays: stays };
  },
};

// ── SMS Config ────────────────────────────────────────────────────────────────

export const adminSmsService = {
  async get(hotelId: string) {
    const cfg = await prisma.hotelSMSConfig.findUnique({ where: { hotelId } });
    if (!cfg) throw new AppError(404, 'SMS not configured for this hotel');
    return { ...cfg, credentials: '[REDACTED]' };
  },

  async upsert(hotelId: string, data: {
    provider: string;
    credentials: object;
    senderName: string;
    enabled?: boolean;
  }) {
    return prisma.hotelSMSConfig.upsert({
      where: { hotelId },
      create: { hotelId, ...data, enabled: data.enabled ?? true },
      update: data,
    });
  },

  async disable(hotelId: string) {
    await prisma.hotelSMSConfig.update({ where: { hotelId }, data: { enabled: false } });
  },

  async sendTest(hotelId: string, phone: string) {
    const hotel = await prisma.hotel.findUniqueOrThrow({ where: { id: hotelId } });
    await smsService.send({
      hotelId,
      phone,
      template: 'app_download',
      context: { guestName: 'Test', hotelName: hotel.name, appLink: 'roomie://open' },
    });
    return { sent: true, phone };
  },
};

// ── POS Config ────────────────────────────────────────────────────────────────

export const adminPosService = {
  async get(hotelId: string) {
    const cfg = await prisma.hotelPOSConfig.findUnique({ where: { hotelId } });
    if (!cfg) throw new AppError(404, 'POS not configured for this hotel');
    return { ...cfg, accessToken: '[REDACTED]' };
  },

  async upsert(hotelId: string, data: {
    posType: string;
    apiUrl: string;
    accessToken: string;
    spotId?: string;
    syncEnabled?: boolean;
    syncInterval?: number;
    categoryMap?: object;
  }) {
    return prisma.hotelPOSConfig.upsert({
      where: { hotelId },
      create: { hotelId, ...data },
      update: data,
    });
  },

  async testConnection(hotelId: string): Promise<{ success: boolean; message: string }> {
    const cfg = await prisma.hotelPOSConfig.findUnique({ where: { hotelId } });
    if (!cfg) throw new AppError(404, 'POS not configured');

    try {
      const { POSFactory } = await import('../pos/POSFactory');
      const adapter = POSFactory.createAdapter(cfg);
      if (!adapter) return { success: false, message: `POS type ${cfg.posType} not supported` };
      await adapter.getMenu();
      return { success: true, message: 'POS connection OK' };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Connection failed';
      return { success: false, message };
    }
  },

  async syncMenu(hotelId: string) {
    const { syncMenuFromPOS } = await import('../pos/menuSync.service');
    await syncMenuFromPOS(hotelId);
    return { triggered: true };
  },
};

// ── Monitoring ────────────────────────────────────────────────────────────────

export const adminMonitoringService = {
  async overview() {
    const hotels = await prisma.hotel.findMany({
      include: {
        pmsConfig: { select: { pmsType: true, isActive: true, lastSyncAt: true, syncMode: true } },
        smsConfig: { select: { provider: true, enabled: true } },
        posConfig: { select: { posType: true, syncEnabled: true } },
        _count: { select: { qrCodes: true } },
      },
    });

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const results = await Promise.all(
      hotels.map(async (hotel) => {
        const [
          smsSentToday,
          smsFailedToday,
          qrScansToday,
          guestsInStay,
          guestsPreArrival,
          ordersToday,
          ordersRevenue,
          posMenuCount,
          pmsTotalSynced,
        ] = await Promise.all([
          prisma.sMSLog.count({ where: { hotelId: hotel.id, status: 'sent', createdAt: { gte: todayStart } } }),
          prisma.sMSLog.count({ where: { hotelId: hotel.id, status: 'failed', createdAt: { gte: todayStart } } }),
          prisma.qRScan.count({ where: { qrCode: { hotelId: hotel.id }, scannedAt: { gte: todayStart } } }),
          prisma.guestStay.count({ where: { hotelId: hotel.id, stage: 'IN_STAY' } }),
          prisma.guestStay.count({ where: { hotelId: hotel.id, stage: 'PRE_ARRIVAL' } }),
          prisma.order.count({ where: { hotelId: hotel.id, createdAt: { gte: todayStart } } }),
          prisma.order.aggregate({ where: { hotelId: hotel.id, createdAt: { gte: todayStart } }, _sum: { subtotal: true } }),
          hotel.posConfig
            ? prisma.hotelService.count({ where: { hotelId: hotel.id, source: 'POS_SYNC' } })
            : Promise.resolve(0),
          prisma.guestStay.count({ where: { hotelId: hotel.id, pmsProvider: { not: null } } }),
        ]);

        let pmsLastSyncStatus: 'ok' | 'error' | 'never' = 'never';
        if (hotel.pmsConfig?.lastSyncAt) {
          pmsLastSyncStatus = 'ok';
        }

        return {
          hotelId: hotel.id,
          hotelName: hotel.name,
          pmsProvider: hotel.pmsConfig?.pmsType || null,
          pmsEnabled: hotel.pmsConfig?.isActive || false,
          pmsLastSyncAt: hotel.pmsConfig?.lastSyncAt || null,
          pmsLastSyncStatus,
          pmsLastSyncError: null,
          pmsTotalSynced,
          smsProvider: hotel.smsConfig?.provider || null,
          smsEnabled: hotel.smsConfig?.enabled || false,
          smsSentToday,
          smsFailedToday,
          posProvider: hotel.posConfig?.posType || null,
          posEnabled: hotel.posConfig?.syncEnabled || false,
          posMenuItems: posMenuCount,
          qrCount: hotel._count.qrCodes,
          qrScansToday,
          guestsInStay,
          guestsPreArrival,
          ordersToday,
          ordersTodayRevenue: Number(ordersRevenue._sum.subtotal || 0),
        };
      }),
    );

    return results;
  },

  async smsErrors(limit = 50) {
    return prisma.sMSLog.findMany({
      where: { status: 'failed' },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true, hotelId: true, phone: true, template: true,
        provider: true, errorMsg: true, createdAt: true,
        hotel: { select: { name: true } },
      },
    });
  },
};

// ── Managers ──────────────────────────────────────────────────────────────────

export const adminManagerService = {
  async list() {
    return prisma.dashboardManager.findMany({
      include: { hotels: { include: { hotel: { select: { id: true, name: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
  },

  async create(data: { username: string; password: string; role?: string }) {
    const existing = await prisma.dashboardManager.findUnique({ where: { username: data.username } });
    if (existing) throw new AppError(409, 'Username already taken');

    const passwordHash = await bcrypt.hash(data.password, 10);
    return prisma.dashboardManager.create({
      data: { username: data.username, passwordHash, role: data.role || 'manager' },
    });
  },

  async update(managerId: string, data: { username?: string; password?: string; role?: string }) {
    const updateData: Record<string, unknown> = {};
    if (data.username) updateData.username = data.username;
    if (data.role) updateData.role = data.role;
    if (data.password) updateData.passwordHash = await bcrypt.hash(data.password, 10);

    return prisma.dashboardManager.update({ where: { id: managerId }, data: updateData });
  },

  async delete(managerId: string) {
    return prisma.dashboardManager.delete({ where: { id: managerId } });
  },

  async linkHotels(managerId: string, hotelIds: string[]) {
    // Remove old links, add new ones
    await prisma.dashboardManagerHotel.deleteMany({ where: { managerId } });

    if (hotelIds.length > 0) {
      await prisma.dashboardManagerHotel.createMany({
        data: hotelIds.map((hotelId) => ({ managerId, hotelId })),
        skipDuplicates: true,
      });
    }

    return prisma.dashboardManager.findUniqueOrThrow({
      where: { id: managerId },
      include: { hotels: { include: { hotel: { select: { id: true, name: true } } } } },
    });
  },
};

// ── Service Categories & Items ───────────────────────────────────────────────

export const adminServiceCategoryService = {
  async list(hotelId: string) {
    return prisma.serviceCategory.findMany({
      where: { hotelId },
      orderBy: { sortOrder: 'asc' },
      include: {
        items: { orderBy: { sortOrder: 'asc' } },
        _count: { select: { requests: true } },
      },
    });
  },

  async create(hotelId: string, data: {
    name: string;
    nameUk?: string;
    nameEn?: string;
    slug: string;
    icon?: string;
    description?: string;
    descriptionUk?: string;
    descriptionEn?: string;
    sortOrder?: number;
    requiresRoom?: boolean;
    requiresTimeSlot?: boolean;
    autoAccept?: boolean;
    estimatedMinutes?: number;
  }) {
    return prisma.serviceCategory.create({
      data: { hotelId, ...data },
      include: { items: true },
    });
  },

  async update(categoryId: string, data: Partial<{
    name: string;
    nameUk: string;
    nameEn: string;
    slug: string;
    icon: string;
    description: string;
    descriptionUk: string;
    descriptionEn: string;
    sortOrder: number;
    isActive: boolean;
    requiresRoom: boolean;
    requiresTimeSlot: boolean;
    autoAccept: boolean;
    estimatedMinutes: number;
  }>) {
    return prisma.serviceCategory.update({
      where: { id: categoryId },
      data,
      include: { items: true },
    });
  },

  async delete(categoryId: string) {
    return prisma.serviceCategory.delete({ where: { id: categoryId } });
  },

  async seed(hotelId: string) {
    return seedDefaultCategories(hotelId);
  },

  async createItem(categoryId: string, data: {
    name: string;
    nameUk?: string;
    nameEn?: string;
    description?: string;
    descriptionUk?: string;
    descriptionEn?: string;
    icon?: string;
    price?: number;
    currency?: string;
    maxQuantity?: number;
    sortOrder?: number;
  }) {
    return prisma.serviceItem.create({
      data: { categoryId, ...data },
    });
  },

  async updateItem(itemId: string, data: Partial<{
    name: string;
    nameUk: string;
    nameEn: string;
    description: string;
    descriptionUk: string;
    descriptionEn: string;
    icon: string;
    price: number;
    currency: string;
    isActive: boolean;
    maxQuantity: number;
    sortOrder: number;
  }>) {
    return prisma.serviceItem.update({
      where: { id: itemId },
      data,
    });
  },

  async deleteItem(itemId: string) {
    return prisma.serviceItem.delete({ where: { id: itemId } });
  },
};

// ── TMS Config ───────────────────────────────────────────────────────────────

export const adminTmsService = {
  async get(hotelId: string) {
    const cfg = await prisma.hotelTMSConfig.findUnique({ where: { hotelId } });
    if (!cfg) throw new AppError(404, 'TMS not configured for this hotel');
    return { ...cfg, credentials: '[REDACTED]' };
  },

  async upsert(hotelId: string, data: {
    provider: string;
    credentials: object;
    enabled?: boolean;
    categoryMapping?: object;
  }) {
    return prisma.hotelTMSConfig.upsert({
      where: { hotelId },
      create: {
        hotelId,
        provider: data.provider,
        credentials: data.credentials,
        enabled: data.enabled ?? false,
        categoryMapping: data.categoryMapping ?? {},
      },
      update: data,
    });
  },

  async disable(hotelId: string) {
    await prisma.hotelTMSConfig.update({
      where: { hotelId },
      data: { enabled: false },
    });
  },

  async testConnection(hotelId: string) {
    return tmsConnector.testConnection(hotelId);
  },

  async updateMapping(hotelId: string, mapping: Record<string, string>) {
    return prisma.hotelTMSConfig.update({
      where: { hotelId },
      data: { categoryMapping: mapping },
    });
  },
};
