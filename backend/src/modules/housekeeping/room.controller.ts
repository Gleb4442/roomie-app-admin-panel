import { Request, Response } from 'express';
import { roomService } from './room.service';
import { HousekeepingStatus, OccupancyStatus } from '@prisma/client';
import { AppError } from '../../shared/middleware/errorHandler';

// ── Dashboard Controllers ─────────────────────────────────────────────────────

export const listRooms = async (req: Request, res: Response) => {
  const hotelId = req.params.hotelId as string;
  const floor = req.query.floor ? Number(req.query.floor as string) : undefined;
  const housekeepingStatus = req.query.status as HousekeepingStatus | undefined;
  const occupancyStatus = req.query.occupancy as OccupancyStatus | undefined;

  const rooms = await roomService.listRooms(hotelId, { floor, housekeepingStatus, occupancyStatus });
  res.json({ rooms });
};

export const getBoard = async (req: Request, res: Response) => {
  const hotelId = req.params.hotelId as string;
  const data = await roomService.getBoardByFloor(hotelId);
  res.json(data);
};

export const getRoomDetail = async (req: Request, res: Response) => {
  const hotelId = req.params.hotelId as string;
  const roomId = req.params.roomId as string;
  const room = await roomService.getRoomDetail(hotelId, roomId);
  if (!room) throw new AppError(404, 'Room not found');
  res.json({ room });
};

export const bulkCreateRooms = async (req: Request, res: Response) => {
  const hotelId = req.params.hotelId as string;
  const { rooms } = req.body;
  if (!Array.isArray(rooms) || rooms.length === 0) {
    throw new AppError(400, 'rooms array required');
  }
  const created = await roomService.bulkCreate(hotelId, rooms);
  res.json({ created: created.length, rooms: created });
};

export const updateRoomStatus = async (req: Request, res: Response) => {
  const hotelId = req.params.hotelId as string;
  const roomId = req.params.roomId as string;
  const { status, notes } = req.body;
  const staffId = (req as any).staff?.staffId ?? (req as any).manager?.id;

  if (!status) throw new AppError(400, 'status required');

  const room = await roomService.getRoomDetail(hotelId, roomId);
  if (!room) throw new AppError(404, 'Room not found');

  const updated = await roomService.updateHousekeepingStatus(roomId, status, {
    staffId,
    source: 'DASHBOARD',
    notes,
  });
  res.json({ room: updated });
};

export const assignCleaner = async (req: Request, res: Response) => {
  const hotelId = req.params.hotelId as string;
  const roomId = req.params.roomId as string;
  const { staffId, inspectorId } = req.body;

  const room = await roomService.getRoomDetail(hotelId, roomId);
  if (!room) throw new AppError(404, 'Room not found');

  let updated;
  if (staffId !== undefined) {
    updated = await roomService.assignCleaner(roomId, staffId || null);
  }
  if (inspectorId !== undefined) {
    updated = await roomService.assignInspector(roomId, inspectorId || null);
  }
  if (!updated) throw new AppError(400, 'staffId or inspectorId required');

  res.json({ room: updated });
};

export const toggleRush = async (req: Request, res: Response) => {
  const hotelId = req.params.hotelId as string;
  const roomId = req.params.roomId as string;
  const room = await roomService.getRoomDetail(hotelId, roomId);
  if (!room) throw new AppError(404, 'Room not found');

  const updated = await roomService.setRush(roomId, !room.isRush);
  res.json({ room: updated });
};

export const toggleDND = async (req: Request, res: Response) => {
  const hotelId = req.params.hotelId as string;
  const roomId = req.params.roomId as string;
  const { active } = req.body;
  const room = await roomService.getRoomDetail(hotelId, roomId);
  if (!room) throw new AppError(404, 'Room not found');

  const updated = await roomService.setDND(roomId, active ?? !room.dndActive);
  res.json({ room: updated });
};

// ── Staff Controllers ─────────────────────────────────────────────────────────

export const getStaffRooms = async (req: Request, res: Response) => {
  const staff = (req as any).staff;
  const hotelId = staff?.hotelId as string;
  const floor = staff?.assignedFloor ? Number(staff.assignedFloor) : undefined;

  const rooms = await roomService.listRooms(hotelId, { floor });
  res.json({ rooms });
};

export const staffUpdateRoomStatus = async (req: Request, res: Response) => {
  const staff = (req as any).staff;
  const roomId = req.params.roomId as string;
  const { status, notes } = req.body;

  if (!status) throw new AppError(400, 'status required');

  const room = await roomService.getRoomDetail(staff.hotelId as string, roomId);
  if (!room) throw new AppError(404, 'Room not found');

  const updated = await roomService.updateHousekeepingStatus(roomId, status, {
    staffId: staff.staffId as string,
    source: 'STAFF_APP',
    notes,
  });
  res.json({ room: updated });
};
