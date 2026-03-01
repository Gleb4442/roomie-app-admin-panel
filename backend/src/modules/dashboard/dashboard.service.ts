import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../config/database';
import { env } from '../../config/environment';
import { AppError } from '../../shared/middleware/errorHandler';

// ── Auth ──────────────────────────────────────────────────────────────────────

export const dashboardAuthService = {
  async login(username: string, password: string) {
    const manager = await prisma.dashboardManager.findUnique({
      where: { username },
      include: { hotels: { include: { hotel: { select: { id: true, name: true, slug: true } } } } },
    });

    if (!manager) throw new AppError(401, 'Invalid credentials');

    const valid = await bcrypt.compare(password, manager.passwordHash);
    if (!valid) throw new AppError(401, 'Invalid credentials');

    const token = jwt.sign(
      { managerId: manager.id, role: manager.role },
      env.dashboardJwtSecret,
      { expiresIn: '7d' },
    );

    return {
      token,
      manager: {
        id: manager.id,
        username: manager.username,
        role: manager.role,
        hotels: manager.hotels.map((h) => h.hotel),
      },
    };
  },
};

// ── Overview ──────────────────────────────────────────────────────────────────

export const dashboardOverviewService = {
  async get(hotelId: string) {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [
      todayGuests,
      todayOrders,
      todayQRScans,
      todaySMS,
      ordersRevenue,
      recentOrders,
      recentStageChanges,
    ] = await Promise.all([
      prisma.guestStay.count({ where: { hotelId, stage: 'IN_STAY' } }),
      prisma.order.count({ where: { hotelId, createdAt: { gte: todayStart } } }),
      prisma.qRScan.count({ where: { qrCode: { hotelId }, scannedAt: { gte: todayStart } } }),
      prisma.sMSLog.count({ where: { hotelId, status: 'sent', createdAt: { gte: todayStart } } }),
      prisma.order.aggregate({
        where: { hotelId, createdAt: { gte: todayStart } },
        _sum: { subtotal: true },
      }),
      prisma.order.findMany({
        where: { hotelId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          items: { include: { service: { select: { name: true } } } },
          guest: { select: { firstName: true, lastName: true } },
        },
      }),
      prisma.stageTransition.findMany({
        where: { guestStay: { hotelId } },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          guestStay: {
            select: {
              roomNumber: true,
              guest: { select: { firstName: true, lastName: true } },
            },
          },
        },
      }),
    ]);

    return {
      todayGuests,
      todayOrders,
      todayQRScans,
      todaySMS,
      todayRevenue: Number(ordersRevenue._sum.subtotal || 0),
      recentOrders: recentOrders.map((o) => ({
        id: o.id,
        roomNumber: o.roomNumber,
        guestName: `${o.guest.firstName} ${o.guest.lastName || ''}`.trim(),
        items: o.items.map((i) => `${i.service.name} x${i.quantity}`).join(', '),
        status: o.status,
        totalAmount: Number(o.subtotal),
        createdAt: o.createdAt,
      })),
      recentGuestChanges: recentStageChanges.map((t) => ({
        guestName: `${t.guestStay.guest.firstName} ${t.guestStay.guest.lastName || ''}`.trim(),
        fromStage: t.fromStage,
        toStage: t.toStage,
        roomNumber: t.guestStay.roomNumber,
        changedAt: t.createdAt,
      })),
    };
  },
};

// ── Guests ────────────────────────────────────────────────────────────────────

export const dashboardGuestsService = {
  async list(hotelId: string, params: {
    stage?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const page = params.page || 1;
    const limit = Math.min(params.limit || 20, 100);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { hotelId };

    if (params.stage) {
      where.stage = params.stage.toUpperCase();
    }

    if (params.search) {
      where.guest = {
        OR: [
          { firstName: { contains: params.search, mode: 'insensitive' } },
          { lastName: { contains: params.search, mode: 'insensitive' } },
          { email: { contains: params.search, mode: 'insensitive' } },
          { phone: { contains: params.search } },
        ],
      };
    }

    const [stays, total] = await Promise.all([
      prisma.guestStay.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: {
          guest: { select: { firstName: true, lastName: true, phone: true, email: true } },
        },
      }),
      prisma.guestStay.count({ where }),
    ]);

    return {
      guests: stays.map((s) => ({
        id: s.id,
        guestName: `${s.guest.firstName} ${s.guest.lastName || ''}`.trim(),
        phone: s.guest.phone || '',
        email: s.guest.email,
        roomNumber: s.roomNumber,
        stage: s.stage,
        checkIn: s.checkIn,
        checkOut: s.checkOut,
        source: s.source,
        preCheckinCompleted: s.preCheckinCompleted,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  },
};

// ── Orders ────────────────────────────────────────────────────────────────────

export const dashboardOrdersService = {
  async list(hotelId: string, params: {
    status?: string;
    date?: string;
    page?: number;
    limit?: number;
  }) {
    const page = params.page || 1;
    const limit = Math.min(params.limit || 20, 100);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { hotelId };

    if (params.status === 'active') {
      where.status = { in: ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'IN_TRANSIT'] };
    } else if (params.status === 'completed') {
      where.status = { in: ['DELIVERED', 'COMPLETED'] };
    }

    if (params.date) {
      const dateStart = new Date(params.date);
      const dateEnd = new Date(params.date);
      dateEnd.setDate(dateEnd.getDate() + 1);
      where.createdAt = { gte: dateStart, lt: dateEnd };
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          items: { include: { service: { select: { name: true } } } },
          guest: { select: { firstName: true, lastName: true } },
        },
      }),
      prisma.order.count({ where }),
    ]);

    return {
      orders: orders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        roomNumber: o.roomNumber,
        guestName: `${o.guest.firstName} ${o.guest.lastName || ''}`.trim(),
        items: o.items.map((i) => ({
          name: i.service.name,
          quantity: i.quantity,
          price: Number(i.price),
        })),
        totalAmount: Number(o.subtotal),
        status: o.status,
        createdAt: o.createdAt,
        updatedAt: o.updatedAt,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  },
};

// ── Stats ─────────────────────────────────────────────────────────────────────

export const dashboardStatsService = {
  async get(hotelId: string, from: string, to: string) {
    const fromDate = new Date(from);
    const toDate = new Date(to);
    toDate.setDate(toDate.getDate() + 1); // inclusive

    // Use $queryRaw for daily aggregations
    const [
      appOpensByDay,
      ordersByDay,
      qrScansByDay,
      qrScansByRoom,
      smsStat,
      guestStages,
      topItems,
      reservationsByDay,
      reservationsBySource,
      ordersAggregate,
    ] = await Promise.all([
      // App opens daily
      prisma.$queryRaw<Array<{ date: string; unique_guests: bigint; total_opens: bigint }>>`
        SELECT
          DATE_TRUNC('day', "createdAt")::date::text as date,
          COUNT(DISTINCT "guestId") as unique_guests,
          COUNT(*) as total_opens
        FROM app_opens
        WHERE "hotelId" = ${hotelId}
          AND "createdAt" >= ${fromDate}
          AND "createdAt" < ${toDate}
        GROUP BY DATE_TRUNC('day', "createdAt")
        ORDER BY date
      `,
      // Orders daily
      prisma.$queryRaw<Array<{ date: string; count: bigint; revenue: number }>>`
        SELECT
          DATE_TRUNC('day', "createdAt")::date::text as date,
          COUNT(*) as count,
          COALESCE(SUM(subtotal), 0)::float as revenue
        FROM orders
        WHERE "hotelId" = ${hotelId}
          AND "createdAt" >= ${fromDate}
          AND "createdAt" < ${toDate}
        GROUP BY DATE_TRUNC('day', "createdAt")
        ORDER BY date
      `,
      // QR scans daily
      prisma.$queryRaw<Array<{ date: string; count: bigint }>>`
        SELECT
          DATE_TRUNC('day', qs."scannedAt")::date::text as date,
          COUNT(*) as count
        FROM qr_scans qs
        JOIN qr_codes qc ON qs."qrCodeId" = qc.id
        WHERE qc."hotelId" = ${hotelId}
          AND qs."scannedAt" >= ${fromDate}
          AND qs."scannedAt" < ${toDate}
        GROUP BY DATE_TRUNC('day', qs."scannedAt")
        ORDER BY date
      `,
      // QR scans by room
      prisma.$queryRaw<Array<{ room_number: string; count: bigint }>>`
        SELECT
          qc."roomNumber" as room_number,
          COUNT(*) as count
        FROM qr_scans qs
        JOIN qr_codes qc ON qs."qrCodeId" = qc.id
        WHERE qc."hotelId" = ${hotelId}
          AND qs."scannedAt" >= ${fromDate}
          AND qs."scannedAt" < ${toDate}
        GROUP BY qc."roomNumber"
        ORDER BY count DESC
        LIMIT 20
      `,
      // SMS stats
      prisma.sMSLog.groupBy({
        by: ['template', 'status'],
        where: { hotelId, createdAt: { gte: fromDate, lt: toDate } },
        _count: true,
      }),
      // Guest stages
      prisma.guestStay.groupBy({
        by: ['stage'],
        where: { hotelId },
        _count: true,
      }),
      // Top order items
      prisma.$queryRaw<Array<{ name: string; count: bigint; revenue: number }>>`
        SELECT
          hs.name,
          SUM(oi.quantity) as count,
          SUM(oi.quantity * oi.price)::float as revenue
        FROM order_items oi
        JOIN hotel_services hs ON oi."serviceId" = hs.id
        JOIN orders o ON oi."orderId" = o.id
        WHERE o."hotelId" = ${hotelId}
          AND o."createdAt" >= ${fromDate}
          AND o."createdAt" < ${toDate}
        GROUP BY hs.name
        ORDER BY count DESC
        LIMIT 10
      `,
      // Reservations daily
      prisma.$queryRaw<Array<{ date: string; count: bigint }>>`
        SELECT
          DATE_TRUNC('day', "createdAt")::date::text as date,
          COUNT(*) as count
        FROM guest_stays
        WHERE "hotelId" = ${hotelId}
          AND "createdAt" >= ${fromDate}
          AND "createdAt" < ${toDate}
        GROUP BY DATE_TRUNC('day', "createdAt")
        ORDER BY date
      `,
      // Reservations by source
      prisma.guestStay.groupBy({
        by: ['source'],
        where: { hotelId, createdAt: { gte: fromDate, lt: toDate } },
        _count: true,
      }),
      // Orders aggregate
      prisma.order.aggregate({
        where: { hotelId, createdAt: { gte: fromDate, lt: toDate } },
        _count: true,
        _sum: { subtotal: true },
      }),
    ]);

    // Process SMS stats
    const smsTotal = smsStat.reduce((acc, s) => acc + s._count, 0);
    const smsDelivered = smsStat.filter((s) => s.status === 'sent').reduce((acc, s) => acc + s._count, 0);
    const smsFailed = smsStat.filter((s) => s.status === 'failed').reduce((acc, s) => acc + s._count, 0);
    const smsByTemplate = Object.entries(
      smsStat.reduce((acc: Record<string, number>, s) => {
        acc[s.template] = (acc[s.template] || 0) + s._count;
        return acc;
      }, {}),
    ).map(([template, count]) => ({ template, count }));

    // Pre-checkin conversion
    const totalGuests = guestStages.reduce((acc, s) => acc + s._count, 0);
    const [preCheckinCompleted] = await Promise.all([
      prisma.guestStay.count({
        where: { hotelId, preCheckinCompleted: true, createdAt: { gte: fromDate, lt: toDate } },
      }),
    ]);
    const totalInPeriod = await prisma.guestStay.count({
      where: { hotelId, createdAt: { gte: fromDate, lt: toDate } },
    });
    const preCheckinConversion = totalInPeriod > 0
      ? Math.round((preCheckinCompleted / totalInPeriod) * 100)
      : 0;

    const totalOrderCount = ordersAggregate._count;
    const totalRevenue = Number(ordersAggregate._sum.subtotal || 0);

    return {
      appOpens: {
        daily: appOpensByDay.map((r) => ({
          date: r.date,
          uniqueGuests: Number(r.unique_guests),
          totalOpens: Number(r.total_opens),
        })),
        totalUnique: appOpensByDay.reduce((acc, r) => acc + Number(r.unique_guests), 0),
      },
      orders: {
        daily: ordersByDay.map((r) => ({
          date: r.date,
          count: Number(r.count),
          revenue: r.revenue,
        })),
        totalCount: totalOrderCount,
        totalRevenue,
        averageCheck: totalOrderCount > 0 ? Math.round(totalRevenue / totalOrderCount * 100) / 100 : 0,
        topItems: topItems.map((r) => ({
          name: r.name,
          count: Number(r.count),
          revenue: r.revenue,
        })),
      },
      sms: {
        total: smsTotal,
        delivered: smsDelivered,
        failed: smsFailed,
        byTemplate: smsByTemplate,
      },
      qrScans: {
        daily: qrScansByDay.map((r) => ({ date: r.date, count: Number(r.count) })),
        byRoom: qrScansByRoom.map((r) => ({ roomNumber: r.room_number, count: Number(r.count) })),
        total: qrScansByDay.reduce((acc, r) => acc + Number(r.count), 0),
      },
      guestJourney: {
        preArrival: guestStages.find((s) => s.stage === 'PRE_ARRIVAL')?._count || 0,
        inStay: guestStages.find((s) => s.stage === 'IN_STAY')?._count || 0,
        postStay: guestStages.find((s) => s.stage === 'POST_STAY')?._count || 0,
        preCheckinConversion,
        totalGuestsInPeriod: totalInPeriod,
      },
      reservations: {
        daily: reservationsByDay.map((r) => ({ date: r.date, count: Number(r.count) })),
        bySource: reservationsBySource.map((s) => ({ source: s.source || 'unknown', count: s._count })),
        total: reservationsByDay.reduce((acc, r) => acc + Number(r.count), 0),
      },
    };
  },
};

// ── SMS Logs ──────────────────────────────────────────────────────────────────

export const dashboardSmsLogsService = {
  async list(hotelId: string, params: { page?: number; limit?: number; status?: string }) {
    const page = params.page || 1;
    const limit = Math.min(params.limit || 20, 100);
    const skip = (page - 1) * limit;
    const where: Record<string, unknown> = { hotelId };
    if (params.status) where.status = params.status;

    const [logs, total] = await Promise.all([
      prisma.sMSLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, phone: true, template: true, provider: true,
          status: true, errorMsg: true, sentAt: true, createdAt: true,
        },
      }),
      prisma.sMSLog.count({ where }),
    ]);

    return { logs, total, page, totalPages: Math.ceil(total / limit) };
  },
};
