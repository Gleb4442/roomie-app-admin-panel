import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../../config/database';
import { env } from '../../config/environment';
import { AppError } from './errorHandler';

export interface DashboardRequest extends Request {
  manager?: {
    id: string;
    username: string;
    role: string;
    hotelIds: string[];
  };
}

interface DashboardJwtPayload {
  managerId: string;
  role: string;
}

export async function authenticateDashboardManager(
  req: DashboardRequest,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    // Support token in Authorization header OR query param (for SSE)
    const authHeader = req.headers.authorization;
    const queryToken = req.query.token as string | undefined;

    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.split(' ')[1]
      : queryToken;

    if (!token) {
      return next(new AppError(401, 'Missing authorization token'));
    }

    let payload: DashboardJwtPayload;
    try {
      payload = jwt.verify(token, env.dashboardJwtSecret) as DashboardJwtPayload;
    } catch {
      return next(new AppError(401, 'Invalid or expired token'));
    }

    const manager = await prisma.dashboardManager.findUnique({
      where: { id: payload.managerId },
      include: { hotels: { select: { hotelId: true } } },
    });

    if (!manager) {
      return next(new AppError(401, 'Manager not found'));
    }

    req.manager = {
      id: manager.id,
      username: manager.username,
      role: manager.role,
      hotelIds: manager.hotels.map((h) => h.hotelId),
    };

    next();
  } catch (err) {
    next(err);
  }
}

export async function verifyHotelAccess(
  req: DashboardRequest,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const hotelId = req.params.hotelId as string;
    if (!hotelId) return next(new AppError(400, 'hotelId param is required'));

    if (!req.manager) return next(new AppError(401, 'Unauthorized'));

    if (!req.manager.hotelIds.includes(hotelId)) {
      return next(new AppError(403, 'Access denied to this hotel'));
    }

    next();
  } catch (err) {
    next(err);
  }
}
