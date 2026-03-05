/**
 * Tests for chatIntegration.routes.ts (internal service-to-service API)
 */

// Mock dependencies
const mockPrisma = {
  serviceCategory: { findFirst: jest.fn() },
  serviceRequest: { create: jest.fn(), update: jest.fn() },
};
jest.mock('../config/database', () => ({ prisma: mockPrisma }));

const mockRecordStatusChange = jest.fn().mockResolvedValue(undefined);
jest.mock('../modules/task/taskStatusTracker', () => ({
  recordStatusChange: (...args: any[]) => mockRecordStatusChange(...args),
}));

const mockEstimateETA = jest.fn().mockResolvedValue(15);
jest.mock('../modules/task/etaCalculator', () => ({
  estimateETA: (...args: any[]) => mockEstimateETA(...args),
}));

const mockRouteTask = jest.fn();
jest.mock('../modules/task/taskRouter', () => ({
  routeTask: (...args: any[]) => mockRouteTask(...args),
}));

jest.mock('../shared/utils/logger', () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

import express from 'express';
import request from 'supertest';

// We need to set env before importing the router
process.env.INTERNAL_SERVICE_TOKEN = 'test-internal-token';

// Dynamic import to pick up mocks
let app: express.Express;

beforeAll(async () => {
  const routerModule = await import('../modules/task/chatIntegration.routes');
  app = express();
  app.use(express.json());
  app.use('/api/internal/tasks', routerModule.default);
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('POST /api/internal/tasks/from-chat', () => {
  const validPayload = {
    hotelId: 'hotel-1',
    guestId: 'guest-1',
    categorySlug: 'room_service',
    roomNumber: '305',
    comment: 'Extra towels please',
  };

  it('должен вернуть 401 без internal service token', async () => {
    const res = await request(app)
      .post('/api/internal/tasks/from-chat')
      .send(validPayload);

    expect(res.status).toBe(401);
  });

  it('должен вернуть 401 с неправильным token', async () => {
    const res = await request(app)
      .post('/api/internal/tasks/from-chat')
      .set('x-internal-service', 'wrong-token')
      .send(validPayload);

    expect(res.status).toBe(401);
  });

  it('должен вернуть 400 без hotelId', async () => {
    const res = await request(app)
      .post('/api/internal/tasks/from-chat')
      .set('x-internal-service', 'test-internal-token')
      .send({ guestId: 'guest-1' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('hotelId');
  });

  it('должен вернуть 400 без guestId', async () => {
    const res = await request(app)
      .post('/api/internal/tasks/from-chat')
      .set('x-internal-service', 'test-internal-token')
      .send({ hotelId: 'hotel-1' });

    expect(res.status).toBe(400);
  });

  it('должен создать task когда categorySlug найден', async () => {
    mockPrisma.serviceCategory.findFirst
      .mockResolvedValueOnce({ id: 'cat-1' }) // slug lookup
      .mockResolvedValueOnce(null); // default fallback (not called)

    mockPrisma.serviceRequest.create.mockResolvedValue({
      id: 'sr-new',
      category: { name: 'Room Service', slug: 'room_service' },
    });
    mockPrisma.serviceRequest.update.mockResolvedValue({});
    mockRouteTask.mockResolvedValue({ staffId: 'staff-1', groupId: 'grp-1' });

    const res = await request(app)
      .post('/api/internal/tasks/from-chat')
      .set('x-internal-service', 'test-internal-token')
      .send(validPayload);

    expect(res.status).toBe(201);
    expect(res.body.taskId).toBe('sr-new');
    expect(res.body.taskType).toBe('SERVICE_REQUEST');
    expect(res.body.etaMinutes).toBe(15);
    expect(res.body.status).toBe('confirmed');
  });

  it('должен создать task со статусом pending когда нет свободного staff', async () => {
    mockPrisma.serviceCategory.findFirst.mockResolvedValue({ id: 'cat-1' });
    mockPrisma.serviceRequest.create.mockResolvedValue({
      id: 'sr-new',
      category: { name: 'Cleaning', slug: 'cleaning' },
    });
    mockPrisma.serviceRequest.update.mockResolvedValue({});
    mockRouteTask.mockResolvedValue({ staffId: null });

    const res = await request(app)
      .post('/api/internal/tasks/from-chat')
      .set('x-internal-service', 'test-internal-token')
      .send(validPayload);

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('pending');
    expect(res.body.assignedStaffId).toBeNull();
  });

  it('должен вернуть 400 когда нет категории для отеля', async () => {
    mockPrisma.serviceCategory.findFirst
      .mockResolvedValueOnce(null)  // slug lookup
      .mockResolvedValueOnce(null); // default fallback

    const res = await request(app)
      .post('/api/internal/tasks/from-chat')
      .set('x-internal-service', 'test-internal-token')
      .send({
        hotelId: 'hotel-empty',
        guestId: 'guest-1',
        categorySlug: 'nonexistent',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('category');
  });
});
