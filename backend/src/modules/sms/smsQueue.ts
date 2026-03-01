import { Queue, Worker } from 'bullmq';
import { prisma } from '../../config/database';
import { logger } from '../../shared/utils/logger';
import { SMSFactory } from './SMSFactory';
import { env } from '../../config/environment';

const connection = {
  host: new URL(env.redisUrl).hostname || 'localhost',
  port: parseInt(new URL(env.redisUrl).port || '6379', 10),
};

// ──── SMS Send Queue ────────────────────────────

export const smsQueue = new Queue('sms-send', { connection });

// ──── SMS Worker ────────────────────────────────

interface SMSJobData {
  hotelId: string;
  phone: string;
  text: string;
  smsLogId: string;
  senderName: string;
}

const smsWorker = new Worker<SMSJobData>(
  'sms-send',
  async (job) => {
    const { hotelId, phone, text, smsLogId, senderName } = job.data;

    const smsConfig = await prisma.hotelSMSConfig.findUnique({
      where: { hotelId },
    });

    if (!smsConfig) {
      logger.warn({ hotelId, smsLogId }, 'SMS config not found, marking as failed');
      await prisma.sMSLog.update({
        where: { id: smsLogId },
        data: { status: 'failed', errorMsg: 'SMS config not found' },
      });
      return;
    }

    const adapter = SMSFactory.create(smsConfig);

    try {
      const result = await adapter.send({
        to: phone,
        text,
        senderName,
      });

      await prisma.sMSLog.update({
        where: { id: smsLogId },
        data: {
          status: 'sent',
          externalId: result.externalId,
          sentAt: new Date(),
        },
      });

      logger.info({ smsLogId, externalId: result.externalId }, 'SMS sent successfully');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      await prisma.sMSLog.update({
        where: { id: smsLogId },
        data: { status: 'failed', errorMsg: msg },
      });
      logger.error({ smsLogId, error: msg }, 'SMS send failed');
      throw err; // Re-throw for BullMQ retry
    }
  },
  {
    connection,
    concurrency: 5,
    limiter: { max: 10, duration: 1000 },
  },
);

smsWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, error: err.message }, 'SMS job failed');
});

smsWorker.on('completed', (job) => {
  logger.debug({ jobId: job.id }, 'SMS job completed');
});

export { smsWorker };
