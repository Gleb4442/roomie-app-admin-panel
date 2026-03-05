/**
 * Channel-Based SSE for Tasks
 *
 * GET /api/v1/sse/tasks?channels=hotel:{id}:tasks,staff:{id}:tasks&token=JWT
 *
 * Available channels:
 *   - guest:{guestId}:tasks — guest's own tasks
 *   - staff:{staffId}:tasks — staff's assigned tasks
 *   - hotel:{hotelId}:tasks — all hotel tasks (dashboard)
 *   - hotel:{hotelId}:sla — SLA alerts for hotel
 *   - department:{deptId}:tasks — department tasks
 */

import { Router, Request, Response } from 'express';
import { redis } from '../../config/redis';
import { verifyStaffToken } from '../staff/staff.service';
import { logger } from '../../shared/utils/logger';

const router = Router();

// Channel name patterns that are allowed
const VALID_CHANNEL_PATTERNS = [
  /^guest:[a-f0-9-]+:tasks$/,
  /^staff:[a-f0-9-]+:tasks$/,
  /^hotel:[a-f0-9-]+:tasks$/,
  /^hotel:[a-f0-9-]+:sla$/,
  /^department:[a-f0-9-]+:tasks$/,
  /^rooms:[a-f0-9-]+$/,
];

function isValidChannel(channel: string): boolean {
  return VALID_CHANNEL_PATTERNS.some(p => p.test(channel));
}

router.get('/tasks', async (req: Request, res: Response) => {
  const channelsParam = req.query.channels as string;
  const token = req.query.token as string;

  if (!channelsParam) {
    res.status(400).json({ error: 'channels parameter required' });
    return;
  }

  // Authenticate via token query param (SSE can't use headers)
  let authContext: { staffId?: string; hotelId?: string } = {};
  if (token) {
    try {
      const decoded = verifyStaffToken(token);
      authContext = { staffId: decoded.staffId, hotelId: decoded.hotelId };
    } catch {
      // Try guest token
      try {
        const jwt = require('jsonwebtoken');
        if (!process.env.JWT_SECRET) {
          res.status(500).json({ error: 'JWT_SECRET not configured' });
          return;
        }
        const decoded = jwt.verify(token, process.env.JWT_SECRET) as any;
        authContext = { staffId: decoded.guestId };
      } catch {
        res.status(401).json({ error: 'Invalid token' });
        return;
      }
    }
  }

  const channels = channelsParam.split(',').filter(isValidChannel);
  if (channels.length === 0) {
    res.status(400).json({ error: 'No valid channels provided' });
    return;
  }

  // SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  // Send initial connected event
  res.write(`event: connected\ndata: ${JSON.stringify({ channels })}\n\n`);

  // Subscribe to Redis channels
  const subscriber = redis.duplicate();
  await subscriber.subscribe(...channels);

  let clientDisconnected = false;

  subscriber.on('message', (channel: string, message: string) => {
    if (clientDisconnected) return;
    try {
      const parsed = JSON.parse(message);
      res.write(`event: task_update\ndata: ${JSON.stringify({ channel, ...parsed })}\n\n`);
    } catch (err) {
      logger.warn({ channel, err }, '[SSE] Failed to write/parse message');
    }
  });

  // Heartbeat every 30s
  const heartbeat = setInterval(() => {
    if (clientDisconnected) return;
    try {
      res.write(': heartbeat\n\n');
    } catch {
      // Client disconnected, cleanup will happen via 'close' event
    }
  }, 30000);

  // Cleanup on disconnect
  req.on('close', () => {
    clientDisconnected = true;
    clearInterval(heartbeat);
    subscriber.unsubscribe().catch(() => {});
    subscriber.quit().catch(() => {});
    logger.info({ channels }, '[SSE] Client disconnected from task channels');
  });
});

export default router;
