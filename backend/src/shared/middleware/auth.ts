import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../../config/environment';
import { AuthenticatedRequest } from '../types';
import { AppError } from './errorHandler';

interface JwtPayload {
  id: string;
  phone: string;
}

export function authenticateGuestJWT(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction,
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return next(new AppError(401, 'Missing or invalid authorization header'));
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, env.jwtSecret) as JwtPayload;
    req.guest = { id: payload.id, phone: payload.phone };
    next();
  } catch {
    next(new AppError(401, 'Invalid or expired token'));
  }
}
