import { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Wraps an async route handler so that thrown errors are passed to next().
 * Express 4 doesn't catch async errors automatically.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>,
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
