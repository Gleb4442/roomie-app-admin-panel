import express from 'express';
import cors from 'cors';
import path from 'path';
import guestRoutes from './modules/guest/guest.routes';
import trackingRoutes from './modules/tracking/tracking.routes';
import hotelRoutes from './modules/hotel/hotel.routes';
import journeyRoutes from './modules/journey/journey.routes';
import servicesRoutes from './modules/services/services.routes';
import orderRoutes from './modules/orders/order.routes';
import precheckinRoutes from './modules/precheckin/precheckin.routes';
import posRoutes from './modules/pos/pos.routes';
import pmsRoutes from './modules/pms/pms.routes';
import smsRoutes from './modules/sms/sms.routes';
import adminRoutes from './modules/admin/admin.routes';
import dashboardRoutes from './modules/dashboard/dashboard.routes';
import taskRoutes from './modules/task/task.routes';
import staffRoutes from './modules/staff/staff.routes';
import staffDashboardRoutes from './modules/staff/staff-dashboard.routes';
import departmentRoutes from './modules/task/department.routes';
import unifiedTaskRoutes from './modules/task/unifiedTask.routes';
import tmsWebhookRoutes from './modules/task/tmsWebhook.routes';
import taskSSERoutes from './modules/task/taskSSE';
import chatIntegrationRoutes from './modules/task/chatIntegration.routes';
import qrFallbackRoutes from './modules/qr/qr.routes';
import { dashboardRouter as housekeepingDashboardRoutes } from './modules/housekeeping/room.routes';
import { errorHandler } from './shared/middleware/errorHandler';
import { env } from './config/environment';

// Start cron jobs
import './jobs/orderTimer.job';
import './jobs/posSync.job';
import './jobs/pmsSyncJob';
import './jobs/slaMonitor.job';

// Start SMS worker
import './modules/sms/smsQueue';

// Initialize TaskEventBus SSE listeners
import './modules/task/taskStatusTracker';

// Initialize rating service (auto-schedules rating requests on task completion)
import './modules/task/ratingService';

// Initialize TMS adapter manager (syncs task events to external TMS)
import './modules/task/tmsAdapterManager';

// Initialize notification service (push notifications for guests and staff)
import './modules/task/notificationService';

const app = express();

app.use(cors());
app.use(express.json());

// Static files — QR PNGs, PDFs, logos
app.use('/uploads', express.static(path.join(process.cwd(), env.uploadsDir)));

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Guest / App routes ────────────────────────────────────────────────────────
app.use('/api/guest', guestRoutes);
app.use('/api/guest', journeyRoutes);
app.use('/api/tracking', trackingRoutes);
app.use('/api/hotels', hotelRoutes);
app.use('/api/hotels', servicesRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/hotels', taskRoutes);
app.use('/api/precheckin', precheckinRoutes);
app.use('/api/pos', posRoutes);
app.use('/api', pmsRoutes);
app.use('/api', smsRoutes);

// ── Unified Task API (v1) ─────────────────────────────────────────────────────
app.use('/api/v1/tasks', unifiedTaskRoutes);
app.use('/api/v1/webhooks', tmsWebhookRoutes);
app.use('/api/v1/sse', taskSSERoutes);

// ── Internal API (service-to-service from roomie-backend) ─────────────────────
app.use('/api/internal/tasks', chatIntegrationRoutes);

// ── Staff API (Hotel staff — separate JWT) ────────────────────────────────────
app.use('/api/staff', staffRoutes);

// ── Admin API (HotelMol team) ─────────────────────────────────────────────────
app.use('/api/admin', adminRoutes);

// ── Dashboard API (Hotel GMs) ─────────────────────────────────────────────────
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/dashboard/staff', staffDashboardRoutes);
app.use('/api/dashboard', departmentRoutes);
app.use('/api/dashboard/housekeeping', housekeepingDashboardRoutes);

// ── QR fallback page (deep link redirect) ─────────────────────────────────────
app.use('/qr', qrFallbackRoutes);

// Error handler (must be last)
app.use(errorHandler);

export default app;
