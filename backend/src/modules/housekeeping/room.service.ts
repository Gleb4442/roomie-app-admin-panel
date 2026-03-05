import { prisma } from '../../config/database';
import { redis } from '../../config/redis';
import { logger } from '../../shared/utils/logger';
import { HousekeepingStatus, OccupancyStatus } from '@prisma/client';
import { autoAssignTask } from '../staff/autoAssign.service';

// ── Room CRUD ─────────────────────────────────────────────────────────────────

export interface BulkCreateRoom {
  roomNumber: string;
  floor: number;
  roomType?: string;
  maxOccupancy?: number;
  pmsRoomId?: string;
}

export const roomService = {
  async bulkCreate(hotelId: string, rooms: BulkCreateRoom[]) {
    const created = await prisma.$transaction(
      rooms.map(r =>
        prisma.room.upsert({
          where: { hotelId_roomNumber: { hotelId, roomNumber: r.roomNumber } },
          update: { floor: r.floor, roomType: r.roomType, maxOccupancy: r.maxOccupancy, pmsRoomId: r.pmsRoomId },
          create: { hotelId, ...r },
        }),
      ),
    );
    return created;
  },

  async listRooms(
    hotelId: string,
    filters?: {
      floor?: number;
      housekeepingStatus?: HousekeepingStatus;
      occupancyStatus?: OccupancyStatus;
    },
  ) {
    return prisma.room.findMany({
      where: {
        hotelId,
        isActive: true,
        ...(filters?.floor !== undefined ? { floor: filters.floor } : {}),
        ...(filters?.housekeepingStatus ? { housekeepingStatus: filters.housekeepingStatus } : {}),
        ...(filters?.occupancyStatus ? { occupancyStatus: filters.occupancyStatus } : {}),
      },
      orderBy: [{ floor: 'asc' }, { roomNumber: 'asc' }],
      include: {
        assignedCleaner: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        assignedInspector: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      },
    });
  },

  async getBoardByFloor(hotelId: string) {
    const rooms = await roomService.listRooms(hotelId);
    const byFloor: Record<number, typeof rooms> = {};
    for (const room of rooms) {
      if (!byFloor[room.floor]) byFloor[room.floor] = [];
      byFloor[room.floor].push(room);
    }
    const stats = {
      total: rooms.length,
      dirty: rooms.filter(r => r.housekeepingStatus === 'DIRTY').length,
      cleaning: rooms.filter(r => r.housekeepingStatus === 'CLEANING').length,
      cleaned: rooms.filter(r => r.housekeepingStatus === 'CLEANED').length,
      inspected: rooms.filter(r => r.housekeepingStatus === 'INSPECTED').length,
      ready: rooms.filter(r => r.housekeepingStatus === 'READY').length,
      outOfOrder: rooms.filter(r => r.housekeepingStatus === 'OUT_OF_ORDER').length,
      dnd: rooms.filter(r => r.housekeepingStatus === 'DO_NOT_DISTURB').length,
    };
    return { floors: byFloor, stats };
  },

  async getRoomDetail(hotelId: string, roomId: string) {
    return prisma.room.findFirst({
      where: { id: roomId, hotelId },
      include: {
        assignedCleaner: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        assignedInspector: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        statusHistory: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        cleaningTasks: {
          where: { status: { notIn: ['CLOSED', 'CANCELLED'] } },
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: {
            assignedTo: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    });
  },

  // ── Status Updates ─────────────────────────────────────────────────────────

  async updateHousekeepingStatus(
    roomId: string,
    toStatus: HousekeepingStatus,
    opts: { staffId?: string; source?: string; notes?: string },
  ) {
    const room = await prisma.room.findUnique({ where: { id: roomId } });
    if (!room) throw new Error('Room not found');

    const updateData: Record<string, unknown> = {
      housekeepingStatus: toStatus,
      lastStatusChangedAt: new Date(),
    };

    if (toStatus === 'CLEANED' || toStatus === 'READY') {
      updateData.lastCleanedAt = new Date();
    }
    if (toStatus === 'INSPECTED' || toStatus === 'READY') {
      updateData.lastInspectedAt = new Date();
    }
    if (toStatus === 'READY') {
      updateData.assignedCleanerId = null;
      updateData.assignedInspectorId = null;
      updateData.estimatedReadyAt = null;
    }
    if (toStatus === 'DO_NOT_DISTURB') {
      updateData.dndActive = true;
      updateData.dndStartedAt = new Date();
    }
    if (room.housekeepingStatus === 'DO_NOT_DISTURB' && toStatus !== 'DO_NOT_DISTURB') {
      updateData.dndActive = false;
      updateData.dndStartedAt = null;
    }

    const updated = await prisma.room.update({
      where: { id: roomId },
      data: updateData as any,
    });

    // Audit log
    await prisma.roomStatusChange.create({
      data: {
        roomId,
        fromHousekeeping: room.housekeepingStatus,
        toHousekeeping: toStatus,
        changedByStaffId: opts.staffId,
        changedBySystem: !opts.staffId,
        source: opts.source || 'SYSTEM',
        notes: opts.notes,
      },
    });

    // Publish SSE
    await publishRoomUpdate(room.hotelId, updated);

    // If room becomes DIRTY, auto-create cleaning task
    if (toStatus === 'DIRTY' && room.housekeepingStatus !== 'DIRTY') {
      await createCleaningTask(updated, opts.staffId).catch(err =>
        logger.warn({ err, roomId }, 'Failed to create cleaning task'),
      );
    }

    return updated;
  },

  async updateOccupancyStatus(
    roomId: string,
    toStatus: OccupancyStatus,
    source: string,
  ) {
    const room = await prisma.room.findUnique({ where: { id: roomId } });
    if (!room) throw new Error('Room not found');

    const updated = await prisma.room.update({
      where: { id: roomId },
      data: { occupancyStatus: toStatus, lastStatusChangedAt: new Date() },
    });

    await prisma.roomStatusChange.create({
      data: {
        roomId,
        fromOccupancy: room.occupancyStatus,
        toOccupancy: toStatus,
        changedBySystem: true,
        source,
      },
    });

    await publishRoomUpdate(room.hotelId, updated);
    return updated;
  },

  async assignCleaner(roomId: string, staffId: string | null) {
    const room = await prisma.room.findUnique({ where: { id: roomId } });
    if (!room) throw new Error('Room not found');

    const updated = await prisma.room.update({
      where: { id: roomId },
      data: { assignedCleanerId: staffId },
      include: {
        assignedCleaner: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      },
    });

    await publishRoomUpdate(room.hotelId, updated);
    return updated;
  },

  async assignInspector(roomId: string, staffId: string | null) {
    const room = await prisma.room.findUnique({ where: { id: roomId } });
    if (!room) throw new Error('Room not found');

    const updated = await prisma.room.update({
      where: { id: roomId },
      data: { assignedInspectorId: staffId },
      include: {
        assignedInspector: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      },
    });

    await publishRoomUpdate(room.hotelId, updated);
    return updated;
  },

  async setRush(roomId: string, value: boolean) {
    const room = await prisma.room.findUnique({ where: { id: roomId } });
    if (!room) throw new Error('Room not found');

    const updated = await prisma.room.update({
      where: { id: roomId },
      data: { isRush: value },
    });

    await publishRoomUpdate(room.hotelId, updated);
    return updated;
  },

  async setDND(roomId: string, active: boolean) {
    const room = await prisma.room.findUnique({ where: { id: roomId } });
    if (!room) throw new Error('Room not found');

    if (active) {
      return roomService.updateHousekeepingStatus(roomId, 'DO_NOT_DISTURB', { source: 'SYSTEM' });
    } else {
      // Restore previous non-DND status (default READY)
      const prevStatus = room.housekeepingStatus === 'DO_NOT_DISTURB' ? 'READY' : room.housekeepingStatus;
      return roomService.updateHousekeepingStatus(roomId, prevStatus, { source: 'SYSTEM' });
    }
  },

  // ── PMS Integration ────────────────────────────────────────────────────────

  async handleCheckout(hotelId: string, roomNumber: string) {
    const room = await prisma.room.findUnique({
      where: { hotelId_roomNumber: { hotelId, roomNumber } },
    });
    if (!room) {
      logger.warn({ hotelId, roomNumber }, '[Housekeeping] handleCheckout: room not found');
      return null;
    }

    // Update occupancy to CHECKOUT then VACANT, and housekeeping to DIRTY
    await roomService.updateOccupancyStatus(room.id, 'CHECKOUT', 'PMS_WEBHOOK');
    const updated = await roomService.updateHousekeepingStatus(room.id, 'DIRTY', {
      source: 'PMS_WEBHOOK',
      notes: 'Guest checkout — room needs cleaning',
    });

    // Set occupancy to VACANT after setting dirty
    await prisma.room.update({
      where: { id: room.id },
      data: { occupancyStatus: 'VACANT' },
    });

    logger.info({ hotelId, roomNumber }, '[Housekeeping] Checkout → DIRTY + cleaning task created');
    return updated;
  },

  async handleCheckin(hotelId: string, roomNumber: string) {
    const room = await prisma.room.findUnique({
      where: { hotelId_roomNumber: { hotelId, roomNumber } },
    });
    if (!room) return null;

    await roomService.updateOccupancyStatus(room.id, 'OCCUPIED', 'PMS_WEBHOOK');
    return room;
  },

  async findByRoomNumber(hotelId: string, roomNumber: string) {
    return prisma.room.findUnique({
      where: { hotelId_roomNumber: { hotelId, roomNumber } },
    });
  },
};

// ── Helpers ────────────────────────────────────────────────────────────────

async function publishRoomUpdate(hotelId: string, room: any) {
  try {
    await redis.publish(
      `rooms:${hotelId}`,
      JSON.stringify({ event: 'room_updated', room }),
    );
  } catch (err) {
    logger.warn({ err }, '[Housekeeping] Failed to publish room update');
  }
}

async function createCleaningTask(room: any, triggeredByStaffId?: string) {
  // Find a system staff member (GM or HD) for the hotel to use as task creator
  const systemStaff = await prisma.staffMember.findFirst({
    where: {
      hotelId: room.hotelId,
      isActive: true,
      role: { in: ['GENERAL_MANAGER', 'HEAD_OF_DEPT', 'SUPERVISOR'] },
    },
  });

  if (!systemStaff) {
    logger.warn({ hotelId: room.hotelId }, '[Housekeeping] No staff found to create cleaning task');
    return;
  }

  // Auto-assign a cleaner
  const assigneeId = triggeredByStaffId
    ?? await autoAssignTask(room.hotelId, 'HOUSEKEEPING', room.roomNumber);

  const task = await prisma.internalTask.create({
    data: {
      hotelId: room.hotelId,
      title: `Room ${room.roomNumber} — Cleaning`,
      description: `Post-checkout cleaning for room ${room.roomNumber} (Floor ${room.floor})`,
      department: 'HOUSEKEEPING',
      locationLabel: `Floor ${room.floor}`,
      roomNumber: room.roomNumber,
      roomId: room.id,
      priority: room.isRush ? 'URGENT' : 'NORMAL',
      status: assigneeId ? 'ASSIGNED' : 'NEW',
      createdById: systemStaff.id,
      assignedToId: assigneeId ?? undefined,
      source: 'SYSTEM',
      slaMinutes: 45,
      dueAt: new Date(Date.now() + 45 * 60 * 1000),
    },
  });

  // If assigned, update room to show who's cleaning
  if (assigneeId) {
    await prisma.room.update({
      where: { id: room.id },
      data: {
        housekeepingStatus: 'CLEANING',
        assignedCleanerId: assigneeId,
        lastStatusChangedAt: new Date(),
      },
    });
    await publishRoomUpdate(room.hotelId, { ...room, housekeepingStatus: 'CLEANING', assignedCleanerId: assigneeId });
  }

  logger.info({ taskId: task.id, roomId: room.id, assigneeId }, '[Housekeeping] Cleaning task created');
  return task;
}

// Called from staff task service when a ROOM_TURNOVER InternalTask is completed
export async function onCleaningTaskCompleted(taskId: string) {
  const task = await prisma.internalTask.findUnique({ where: { id: taskId } });
  if (!task?.roomId) return;

  const room = await prisma.room.findUnique({ where: { id: task.roomId } });
  if (!room) return;

  // Move to CLEANED (awaiting inspection)
  await roomService.updateHousekeepingStatus(task.roomId, 'CLEANED', {
    staffId: task.assignedToId ?? undefined,
    source: 'STAFF_APP',
    notes: 'Cleaning task completed',
  });
}
