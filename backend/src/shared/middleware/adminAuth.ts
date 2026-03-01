import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../../config/environment';
import { AppError } from './errorHandler';

export interface AdminRequest extends Request {
  admin?: { id: string; username: string };
}

interface AdminJwtPayload {
  id: string;
  username: string;
}

export function authenticateHotelMolAdmin(
  req: AdminRequest,
  _res: Response,
  next: NextFunction,
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return next(new AppError(401, 'Missing or invalid authorization header'));
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, env.adminJwtSecret) as AdminJwtPayload;
    req.admin = { id: payload.id, username: payload.username };
    next();
  } catch {
    next(new AppError(401, 'Invalid or expired admin token'));
  }
}
