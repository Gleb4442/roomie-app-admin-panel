import { Queue, Worker } from 'bullmq';
import { logger } from '../shared/utils/logger';
import { pmsSyncService } from '../modules/pms/pmsSyncService';
import { env } from '../config/environment';

const connection = {
  host: new URL(env.redisUrl).hostname || 'localhost',
  port: parseInt(new URL(env.redisUrl).port || '6379', 10),
};

// ──── PMS Sync Queue ────────────────────────────

export const pmsSyncQueue = new Queue('pms-sync', { connection });

// Register repeatable job: every 15 minutes
pmsSyncQueue.add('sync-all', {}, {
  repeat: { every: 15 * 60 * 1000 },
}).then(() => {
  logger.info('PMS sync repeatable job registered (every 15 minutes)');
}).catch((err) => {
  logger.error({ error: err }, 'Failed to register PMS sync repeatable job');
});

// ──── PMS Sync Worker ───────────────────────────

const pmsSyncWorker = new Worker(
  'pms-sync',
  async () => {
    logger.info('PMS sync job started');
    await pmsSyncService.syncAll();
    logger.info('PMS sync job completed');
  },
  {
    connection,
    concurrency: 1, // Only one sync at a time
  },
);

pmsSyncWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, error: err.message }, 'PMS sync job failed');
});

pmsSyncWorker.on('completed', (job) => {
  logger.debug({ jobId: job.id }, 'PMS sync job completed');
});

export { pmsSyncWorker };
