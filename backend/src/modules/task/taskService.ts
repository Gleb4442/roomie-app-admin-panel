import { prisma } from '../../config/database';
import { redis } from '../../config/redis';
import { AppError } from '../../shared/middleware/errorHandler';
import { logger } from '../../shared/utils/logger';
import { tmsConnector } from './tmsConnector';
import { CreateRequestParams, HotelRequestFilters, VALID_STATUS_TRANSITIONS } from './types';
import { recordStatusChange, publishServiceRequestUpdate, publishGuestStatusUpdate } from './taskStatusTracker';

// ── Catalog ──────────────────────────────────────────────────────────────────

function localize(
  base: string,
  uk: string | null,
  en: string | null,
  lang?: string,
): string {
  if (lang === 'uk' && uk) return uk;
  if (lang === 'en' && en) return en;
  return base;
}

export const taskCatalogService = {
  async getCategories(hotelId: string, lang?: string) {
    const categories = await prisma.serviceCategory.findMany({
      where: { hotelId, isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        items: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    return categories.map((cat) => ({
      id: cat.id,
      name: localize(cat.name, cat.nameUk, cat.nameEn, lang),
      slug: cat.slug,
      icon: cat.icon,
      description: localize(
        cat.description || '',
        cat.descriptionUk,
        cat.descriptionEn,
        lang,
      ),
      requiresRoom: cat.requiresRoom,
      requiresTimeSlot: cat.requiresTimeSlot,
      autoAccept: cat.autoAccept,
      estimatedMinutes: cat.estimatedMinutes,
      sortOrder: cat.sortOrder,
      items: cat.items.map((item) => ({
        id: item.id,
        name: localize(item.name, item.nameUk, item.nameEn, lang),
        description: localize(
          item.description || '',
          item.descriptionUk,
          item.descriptionEn,
          lang,
        ),
        icon: item.icon,
        price: item.price,
        currency: item.currency,
        maxQuantity: item.maxQuantity,
      })),
    }));
  },

  async getCategory(categoryId: string, lang?: string) {
    const cat = await prisma.serviceCategory.findUnique({
      where: { id: categoryId },
      include: {
        items: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (!cat) throw new AppError(404, 'Category not found');

    return {
      id: cat.id,
      name: localize(cat.name, cat.nameUk, cat.nameEn, lang),
      slug: cat.slug,
      icon: cat.icon,
      description: localize(
        cat.description || '',
        cat.descriptionUk,
        cat.descriptionEn,
        lang,
      ),
      requiresRoom: cat.requiresRoom,
      requiresTimeSlot: cat.requiresTimeSlot,
      autoAccept: cat.autoAccept,
      estimatedMinutes: cat.estimatedMinutes,
      items: cat.items.map((item) => ({
        id: item.id,
        name: localize(item.name, item.nameUk, item.nameEn, lang),
        description: localize(
          item.description || '',
          item.descriptionUk,
          item.descriptionEn,
          lang,
        ),
        icon: item.icon,
        price: item.price,
        currency: item.currency,
        maxQuantity: item.maxQuantity,
      })),
    };
  },
};

// ── Guest Requests ───────────────────────────────────────────────────────────

export const taskRequestService = {
  async createRequest(params: CreateRequestParams) {
    // Validate category exists and belongs to hotel
    const category = await prisma.serviceCategory.findFirst({
      where: { id: params.categoryId, hotelId: params.hotelId, isActive: true },
    });
    if (!category) throw new AppError(404, 'Category not found or inactive');

    // Validate all items belong to this category
    const itemIds = params.items.map((i) => i.serviceItemId);
    const serviceItems = await prisma.serviceItem.findMany({
      where: { id: { in: itemIds }, categoryId: params.categoryId, isActive: true },
    });

    if (serviceItems.length !== itemIds.length) {
      throw new AppError(400, 'One or more items are invalid or inactive');
    }

    // Build items with prices
    const requestItems = params.items.map((reqItem) => {
      const svcItem = serviceItems.find((s) => s.id === reqItem.serviceItemId)!;
      if (reqItem.quantity < 1 || reqItem.quantity > svcItem.maxQuantity) {
        throw new AppError(400, `Quantity for "${svcItem.name}" must be 1-${svcItem.maxQuantity}`);
      }
      return {
        serviceItemId: reqItem.serviceItemId,
        quantity: reqItem.quantity,
        unitPrice: svcItem.price,
        totalPrice: svcItem.price * reqItem.quantity,
      };
    });

    const totalAmount = requestItems.reduce((sum, i) => sum + i.totalPrice, 0);
    const initialStatus = category.autoAccept ? 'accepted' : 'pending';

    const serviceRequest = await prisma.serviceRequest.create({
      data: {
        hotelId: params.hotelId,
        guestId: params.guestId,
        guestStayId: params.guestStayId,
        categoryId: params.categoryId,
        roomNumber: params.roomNumber,
        comment: params.comment,
        requestedTime: params.requestedTime,
        status: initialStatus,
        totalAmount,
        items: {
          create: requestItems,
        },
      },
      include: {
        category: { select: { name: true, nameUk: true, nameEn: true, icon: true, slug: true, estimatedMinutes: true } },
        items: {
          include: { serviceItem: { select: { name: true, nameUk: true, nameEn: true } } },
        },
        guest: { select: { firstName: true, lastName: true } },
      },
    });

    // Record status change + emit event
    recordStatusChange({
      taskId: serviceRequest.id,
      taskType: 'SERVICE_REQUEST',
      hotelId: params.hotelId,
      fromStatus: null,
      toStatus: initialStatus,
      changedById: params.guestId,
      changedByType: 'guest',
    }).catch(() => {});

    // Publish to Redis for dashboard SSE
    publishServiceRequestUpdate(params.hotelId, 'service_request_created', {
      id: serviceRequest.id,
      status: serviceRequest.status,
      category: serviceRequest.category.name,
      roomNumber: serviceRequest.roomNumber,
      guestName: `${serviceRequest.guest.firstName} ${serviceRequest.guest.lastName || ''}`.trim(),
      totalAmount: serviceRequest.totalAmount,
      createdAt: serviceRequest.createdAt,
    });

    // Push to external TMS if configured
    tmsConnector.pushTask(serviceRequest).catch(() => {});

    return serviceRequest;
  },

  async getGuestRequests(guestId: string, guestStayId?: string) {
    const where: Record<string, unknown> = { guestId };
    if (guestStayId) where.guestStayId = guestStayId;

    return prisma.serviceRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        category: { select: { name: true, nameUk: true, nameEn: true, icon: true, slug: true, estimatedMinutes: true } },
        items: {
          include: { serviceItem: { select: { name: true, nameUk: true, nameEn: true } } },
        },
      },
    });
  },

  async cancelRequest(requestId: string, guestId: string) {
    const request = await prisma.serviceRequest.findFirst({
      where: { id: requestId, guestId },
    });

    if (!request) throw new AppError(404, 'Request not found');

    if (!['pending', 'accepted'].includes(request.status)) {
      throw new AppError(400, `Cannot cancel request with status "${request.status}"`);
    }

    const updated = await prisma.serviceRequest.update({
      where: { id: requestId },
      data: { status: 'cancelled' },
      include: {
        category: { select: { name: true, icon: true, slug: true } },
      },
    });

    recordStatusChange({
      taskId: requestId,
      taskType: 'SERVICE_REQUEST',
      hotelId: request.hotelId,
      fromStatus: request.status,
      toStatus: 'cancelled',
      changedById: guestId,
      changedByType: 'guest',
    }).catch(() => {});

    publishServiceRequestUpdate(request.hotelId, 'service_request_updated', {
      id: updated.id, status: 'cancelled',
    });

    return updated;
  },
};

// ── Staff / Dashboard ────────────────────────────────────────────────────────

export const taskStaffService = {
  async updateStatus(
    requestId: string,
    newStatus: string,
    params?: { rejectionReason?: string; scheduledTime?: Date },
  ) {
    const request = await prisma.serviceRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) throw new AppError(404, 'Service request not found');

    const allowed = VALID_STATUS_TRANSITIONS[request.status];
    if (!allowed || !allowed.includes(newStatus)) {
      throw new AppError(400, `Invalid status transition: ${request.status} → ${newStatus}`);
    }

    const updateData: Record<string, unknown> = { status: newStatus };

    if (newStatus === 'rejected' && params?.rejectionReason) {
      updateData.rejectionReason = params.rejectionReason;
    }
    if (newStatus === 'completed') {
      updateData.completedAt = new Date();
    }
    if (params?.scheduledTime) {
      updateData.scheduledTime = params.scheduledTime;
    }

    const updated = await prisma.serviceRequest.update({
      where: { id: requestId },
      data: updateData,
      include: {
        category: { select: { name: true, icon: true, slug: true } },
        items: {
          include: { serviceItem: { select: { name: true } } },
        },
        guest: { select: { firstName: true, lastName: true } },
      },
    });

    // Record status change + emit event
    recordStatusChange({
      taskId: requestId,
      taskType: 'SERVICE_REQUEST',
      hotelId: updated.hotelId,
      fromStatus: request.status,
      toStatus: newStatus,
      changedByType: 'staff',
    }).catch(() => {});

    // Publish status change to dashboard SSE
    publishServiceRequestUpdate(updated.hotelId, 'service_request_updated', {
      id: updated.id,
      status: updated.status,
      category: updated.category.name,
      roomNumber: updated.roomNumber,
      guestName: `${updated.guest.firstName} ${updated.guest.lastName || ''}`.trim(),
    });

    // Notify guest via Redis (for polling)
    publishGuestStatusUpdate(updated.guestId, {
      requestId: updated.id, status: updated.status,
    });

    return updated;
  },

  async getHotelRequests(hotelId: string, filters: HotelRequestFilters) {
    const page = filters.page || 1;
    const limit = Math.min(filters.limit || 20, 100);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { hotelId };

    if (filters.status) where.status = filters.status;
    if (filters.roomNumber) where.roomNumber = filters.roomNumber;

    if (filters.categorySlug) {
      where.category = { slug: filters.categorySlug };
    }

    if (filters.from || filters.to) {
      const createdAt: Record<string, Date> = {};
      if (filters.from) createdAt.gte = filters.from;
      if (filters.to) createdAt.lt = filters.to;
      where.createdAt = createdAt;
    }

    const [requests, total] = await Promise.all([
      prisma.serviceRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          category: { select: { name: true, icon: true, slug: true } },
          items: {
            include: { serviceItem: { select: { name: true } } },
          },
          guest: { select: { firstName: true, lastName: true, phone: true } },
        },
      }),
      prisma.serviceRequest.count({ where }),
    ]);

    return {
      requests: requests.map((r) => ({
        id: r.id,
        category: r.category,
        guestName: `${r.guest.firstName} ${r.guest.lastName || ''}`.trim(),
        guestPhone: r.guest.phone,
        roomNumber: r.roomNumber,
        status: r.status,
        items: r.items.map((i) => ({
          name: i.serviceItem.name,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          totalPrice: i.totalPrice,
        })),
        totalAmount: r.totalAmount,
        comment: r.comment,
        requestedTime: r.requestedTime,
        scheduledTime: r.scheduledTime,
        rejectionReason: r.rejectionReason,
        completedAt: r.completedAt,
        externalTaskId: r.externalTaskId,
        externalSystem: r.externalSystem,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  },

  async getStats(hotelId: string, from: Date, to: Date) {
    const toInclusive = new Date(to);
    toInclusive.setDate(toInclusive.getDate() + 1);

    const [
      totalRequests,
      byStatusRaw,
      byCategoryRaw,
      completedRequests,
      topItemsRaw,
      dailyRaw,
    ] = await Promise.all([
      prisma.serviceRequest.count({
        where: { hotelId, createdAt: { gte: from, lt: toInclusive } },
      }),
      prisma.serviceRequest.groupBy({
        by: ['status'],
        where: { hotelId, createdAt: { gte: from, lt: toInclusive } },
        _count: true,
      }),
      prisma.$queryRaw<Array<{ name: string; slug: string; count: bigint; revenue: number }>>`
        SELECT
          sc.name,
          sc.slug,
          COUNT(sr.id) as count,
          COALESCE(SUM(sr."totalAmount"), 0)::float as revenue
        FROM service_requests sr
        JOIN service_categories sc ON sr."categoryId" = sc.id
        WHERE sr."hotelId" = ${hotelId}
          AND sr."createdAt" >= ${from}
          AND sr."createdAt" < ${toInclusive}
        GROUP BY sc.name, sc.slug
        ORDER BY count DESC
      `,
      prisma.serviceRequest.findMany({
        where: {
          hotelId,
          status: 'completed',
          completedAt: { not: null },
          createdAt: { gte: from, lt: toInclusive },
        },
        select: { createdAt: true, completedAt: true },
      }),
      prisma.$queryRaw<Array<{ name: string; count: bigint }>>`
        SELECT
          si.name,
          SUM(sri.quantity) as count
        FROM service_request_items sri
        JOIN service_items si ON sri."serviceItemId" = si.id
        JOIN service_requests sr ON sri."serviceRequestId" = sr.id
        WHERE sr."hotelId" = ${hotelId}
          AND sr."createdAt" >= ${from}
          AND sr."createdAt" < ${toInclusive}
        GROUP BY si.name
        ORDER BY count DESC
        LIMIT 10
      `,
      prisma.$queryRaw<Array<{ date: string; count: bigint }>>`
        SELECT
          DATE_TRUNC('day', "createdAt")::date::text as date,
          COUNT(*) as count
        FROM service_requests
        WHERE "hotelId" = ${hotelId}
          AND "createdAt" >= ${from}
          AND "createdAt" < ${toInclusive}
        GROUP BY DATE_TRUNC('day', "createdAt")
        ORDER BY date
      `,
    ]);

    const byStatus: Record<string, number> = {};
    for (const row of byStatusRaw) {
      byStatus[row.status] = row._count;
    }

    // Calculate avg completion time
    let avgCompletionMinutes = 0;
    if (completedRequests.length > 0) {
      const totalMinutes = completedRequests.reduce((sum, r) => {
        const diff = r.completedAt!.getTime() - r.createdAt.getTime();
        return sum + diff / 60000;
      }, 0);
      avgCompletionMinutes = Math.round(totalMinutes / completedRequests.length);
    }

    return {
      totalRequests,
      byStatus,
      byCategory: byCategoryRaw.map((r) => ({
        category: r.name,
        slug: r.slug,
        count: Number(r.count),
        revenue: r.revenue,
      })),
      avgCompletionMinutes,
      topItems: topItemsRaw.map((r) => ({
        name: r.name,
        count: Number(r.count),
      })),
      dailyRequests: dailyRaw.map((r) => ({
        date: r.date,
        count: Number(r.count),
      })),
    };
  },
};
