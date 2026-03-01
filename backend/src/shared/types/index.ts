import { Request } from 'express';

export interface AuthenticatedRequest extends Request {
  guest?: {
    id: string;
    phone: string;
  };
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
