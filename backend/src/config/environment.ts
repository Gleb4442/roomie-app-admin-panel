import dotenv from 'dotenv';
dotenv.config();

export const env = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL!,
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  jwtSecret: process.env.JWT_SECRET!,
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET!,
  roomieApiUrl: process.env.ROOMIE_API_URL || 'http://localhost:3000',
  adminJwtSecret: process.env.HOTELMOL_ADMIN_JWT_SECRET || 'admin-secret-change-in-production',
  adminUsername: process.env.HOTELMOL_ADMIN_USERNAME || 'admin',
  adminPassword: process.env.HOTELMOL_ADMIN_PASSWORD || 'admin123',
  dashboardJwtSecret: process.env.DASHBOARD_MANAGER_JWT_SECRET || 'dashboard-secret-change-in-production',
  appBaseUrl: process.env.APP_BASE_URL || 'https://app.hotelmol.com',
  uploadsDir: process.env.UPLOADS_DIR || 'uploads',
  twilioAccountSid: process.env.TWILIO_ACCOUNT_SID || '',
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN || '',
  twilioFromNumber: process.env.TWILIO_FROM_NUMBER || '',
} as const;
