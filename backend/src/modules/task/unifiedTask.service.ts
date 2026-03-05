/**
 * UnifiedTask service — task detail, rating, notes, photos.
 * Operates across all 3 task models using (taskId, taskType) composite key.
 */

import { prisma } from '../../config/database';
import type { TaskType } from './taskEventBus';
import { taskEventBus, TaskEvent } from './taskEventBus';

// ── Task Detail ──────────────────────────────────────────────

export async function getTaskDetail(taskId: string, taskType: TaskType) {
  let task: any = null;

  if (taskType === 'INTERNAL') {
    task = await prisma.internalTask.findUnique({
      where: { id: taskId },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        checklist: true,
        template: { select: { name: true } },
      },
    });
  } else if (taskType === 'SERVICE_REQUEST') {
    task = await prisma.serviceRequest.findUnique({
      where: { id: taskId },
      include: {
        category: { select: { name: true, slug: true, icon: true } },
        items: { include: { serviceItem: { select: { name: true } } } },
        guest: { select: { id: true, firstName: true, lastName: true, phone: true } },
      },
    });
  } else if (taskType === 'ORDER') {
    task = await prisma.order.findUnique({
      where: { id: taskId },
      include: {
        items: { include: { service: { select: { name: true } } } },
        guest: { select: { id: true, firstName: true, lastName: true, phone: true } },
      },
    });
  }

  if (!task) return null;

  // Fetch related data in parallel
  const [statusHistory, notes, photos, comments] = await Promise.all([
    prisma.taskStatusChange.findMany({
      where: { taskId, taskType },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.taskNote.findMany({
      where: { taskId, taskType },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.taskPhoto.findMany({
      where: { taskId, taskType },
      include: { uploader: { select: { firstName: true, lastName: true } } },
      orderBy: { uploadedAt: 'asc' },
    }),
    prisma.taskComment.findMany({
      where: { taskId, taskType },
      include: { author: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  return { task, statusHistory, notes, photos, comments };
}

// ── Rating ───────────────────────────────────────────────────

export async function rateTask(
  taskId: string,
  taskType: TaskType,
  guestId: string,
  rating: number,
  comment?: string,
) {
  if (rating < 1 || rating > 5) throw new Error('INVALID_RATING');

  const now = new Date();
  const ratingData = { rating, ratingComment: comment || null, ratedAt: now };

  let hotelId: string | undefined;

  if (taskType === 'INTERNAL') {
    const t = await prisma.internalTask.update({
      where: { id: taskId },
      data: ratingData,
      select: { hotelId: true },
    });
    hotelId = t.hotelId;
  } else if (taskType === 'SERVICE_REQUEST') {
    const sr = await prisma.serviceRequest.update({
      where: { id: taskId },
      data: ratingData,
      select: { hotelId: true },
    });
    hotelId = sr.hotelId;
  } else if (taskType === 'ORDER') {
    const o = await prisma.order.update({
      where: { id: taskId },
      data: ratingData,
      select: { hotelId: true },
    });
    hotelId = o.hotelId;
  }

  if (hotelId) {
    taskEventBus.emitTaskEvent(TaskEvent.TASK_RATED, {
      taskId,
      taskType,
      hotelId,
      status: 'RATED',
      changedBy: { id: guestId, type: 'guest' as const },
      timestamp: now,
      meta: { rating, comment },
    });
  }

  return { success: true, rating, ratedAt: now };
}

// ── Notes ────────────────────────────────────────────────────

export async function addNote(
  taskId: string,
  taskType: TaskType,
  authorId: string,
  authorType: 'staff' | 'guest' | 'system',
  content: string,
  isInternal: boolean = false,
) {
  const note = await prisma.taskNote.create({
    data: { taskId, taskType, authorId, authorType, content, isInternal },
  });

  // Get hotelId for event
  const hotelId = await getTaskHotelId(taskId, taskType);
  if (hotelId) {
    taskEventBus.emitTaskEvent(TaskEvent.TASK_NOTE_ADDED, {
      taskId,
      taskType,
      hotelId,
      status: 'NOTE_ADDED',
      changedBy: { id: authorId, type: authorType },
      timestamp: new Date(),
      meta: { noteId: note.id, isInternal },
    });
  }

  return note;
}

export async function getTaskNotes(taskId: string, taskType: TaskType, includeInternal: boolean = true) {
  return prisma.taskNote.findMany({
    where: {
      taskId,
      taskType,
      ...(includeInternal ? {} : { isInternal: false }),
    },
    orderBy: { createdAt: 'asc' },
  });
}

// ── Photos ───────────────────────────────────────────────────

export async function addPhoto(
  taskId: string,
  taskType: TaskType,
  uploadedById: string,
  url: string,
  type: string = 'issue',
) {
  return prisma.taskPhoto.create({
    data: { taskId, taskType, uploadedById, url, type },
  });
}

export async function getTaskPhotos(taskId: string, taskType: TaskType) {
  return prisma.taskPhoto.findMany({
    where: { taskId, taskType },
    include: { uploader: { select: { firstName: true, lastName: true } } },
    orderBy: { uploadedAt: 'asc' },
  });
}

// ── Status History ───────────────────────────────────────────

export async function getStatusHistory(taskId: string, taskType: TaskType) {
  return prisma.taskStatusChange.findMany({
    where: { taskId, taskType },
    orderBy: { createdAt: 'asc' },
  });
}

// ── Guest Task List ──────────────────────────────────────────

export async function getGuestTasks(guestId: string, hotelId?: string) {
  const hotelFilter = hotelId ? { hotelId } : {};

  const [serviceRequests, orders] = await Promise.all([
    prisma.serviceRequest.findMany({
      where: { guestId, ...hotelFilter },
      include: {
        category: { select: { name: true, slug: true, icon: true } },
        items: { include: { serviceItem: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    prisma.order.findMany({
      where: { guestId, ...hotelFilter },
      include: {
        items: { include: { service: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
  ]);

  const tasks = [
    ...serviceRequests.map(sr => ({
      id: sr.id,
      taskType: 'SERVICE_REQUEST' as const,
      title: sr.category?.name || 'Service Request',
      status: sr.status,
      priority: sr.priority,
      roomNumber: sr.roomNumber,
      etaMinutes: sr.etaMinutes,
      rating: sr.rating,
      ratingComment: sr.ratingComment,
      ratedAt: sr.ratedAt,
      slaBreached: sr.slaBreached,
      escalationLevel: sr.escalationLevel,
      createdAt: sr.createdAt,
      updatedAt: sr.updatedAt,
      completedAt: sr.completedAt,
      acceptedAt: sr.acceptedAt,
      startedAt: sr.startedAt,
      items: sr.items.map(i => ({ name: i.serviceItem?.name, quantity: i.quantity })),
    })),
    ...orders.map(o => ({
      id: o.id,
      taskType: 'ORDER' as const,
      title: `Order ${o.orderNumber}`,
      status: o.status,
      priority: o.priority,
      roomNumber: o.roomNumber,
      etaMinutes: o.etaMinutes,
      rating: o.rating,
      ratingComment: o.ratingComment,
      ratedAt: o.ratedAt,
      slaBreached: o.slaBreached,
      escalationLevel: o.escalationLevel,
      createdAt: o.createdAt,
      updatedAt: o.updatedAt,
      deliveredAt: o.deliveredAt,
      orderNumber: o.orderNumber,
      items: o.items.map(i => ({ name: i.service?.name, quantity: i.quantity })),
    })),
  ];

  return tasks.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

// ── Hotel Task List (dashboard) ──────────────────────────────

export async function getHotelTasks(hotelId: string, filters?: {
  status?: string[];
  taskType?: TaskType;
  slaBreached?: boolean;
  limit?: number;
}) {
  const limit = filters?.limit ?? 100;
  const tasks: any[] = [];

  if (!filters?.taskType || filters.taskType === 'INTERNAL') {
    const where: any = { hotelId };
    if (filters?.status?.length) where.status = { in: filters.status };
    if (filters?.slaBreached !== undefined) where.slaBreached = filters.slaBreached;

    const internals = await prisma.internalTask.findMany({
      where,
      include: {
        createdBy: { select: { firstName: true, lastName: true } },
        assignedTo: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    tasks.push(...internals.map(t => ({ ...t, taskType: 'INTERNAL' })));
  }

  if (!filters?.taskType || filters.taskType === 'SERVICE_REQUEST') {
    const where: any = { hotelId };
    if (filters?.status?.length) where.status = { in: filters.status };
    if (filters?.slaBreached !== undefined) where.slaBreached = filters.slaBreached;

    const srs = await prisma.serviceRequest.findMany({
      where,
      include: {
        category: { select: { name: true, icon: true } },
        guest: { select: { firstName: true, phone: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    tasks.push(...srs.map(sr => ({ ...sr, taskType: 'SERVICE_REQUEST' })));
  }

  if (!filters?.taskType || filters.taskType === 'ORDER') {
    const where: any = { hotelId };
    if (filters?.status?.length) where.status = { in: filters.status };
    if (filters?.slaBreached !== undefined) where.slaBreached = filters.slaBreached;

    const orders = await prisma.order.findMany({
      where,
      include: {
        guest: { select: { firstName: true, phone: true } },
        items: { include: { service: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    tasks.push(...orders.map(o => ({ ...o, taskType: 'ORDER' })));
  }

  // Each query already returns results sorted by createdAt desc,
  // so we just need to merge-sort and slice to limit.
  // Use getTime() directly since createdAt is already a Date from Prisma.
  return tasks
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit);
}

// ── Helper ───────────────────────────────────────────────────

async function getTaskHotelId(taskId: string, taskType: TaskType): Promise<string | null> {
  if (taskType === 'INTERNAL') {
    const t = await prisma.internalTask.findUnique({ where: { id: taskId }, select: { hotelId: true } });
    return t?.hotelId ?? null;
  }
  if (taskType === 'SERVICE_REQUEST') {
    const sr = await prisma.serviceRequest.findUnique({ where: { id: taskId }, select: { hotelId: true } });
    return sr?.hotelId ?? null;
  }
  if (taskType === 'ORDER') {
    const o = await prisma.order.findUnique({ where: { id: taskId }, select: { hotelId: true } });
    return o?.hotelId ?? null;
  }
  return null;
}
