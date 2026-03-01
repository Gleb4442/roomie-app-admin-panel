import { prisma } from '../../config/database';
import { redis } from '../../config/redis';
import { logger } from '../../shared/utils/logger';
import { PMSFactory } from './PMSFactory';
import { pmsSyncService } from './pmsSyncService';

const WEBHOOK_IDEMPOTENCY_TTL = 86400; // 24 hours
const WEBHOOK_KEY_PREFIX = 'pms-webhook:';

export class PMSWebhookHandler {
  /**
   * Process an incoming PMS webhook.
   * Always responds 200 to the PMS, processes in background.
   */
  async process(
    hotelId: string,
    payload: unknown,
    headers: Record<string, string | string[] | undefined>,
  ): Promise<void> {
    const pmsConfig = await prisma.hotelPMSConfig.findUnique({
      where: { hotelId },
    });

    if (!pmsConfig || !pmsConfig.isActive) {
      logger.warn({ hotelId }, 'PMS webhook received for unconfigured hotel');
      return;
    }

    const adapter = PMSFactory.create(pmsConfig);

    // Verify webhook signature
    if (pmsConfig.webhookSecret) {
      const valid = adapter.verifyWebhookSignature(payload, headers, pmsConfig.webhookSecret);
      if (!valid) {
        logger.warn({ hotelId }, 'PMS webhook signature verification failed');
        return;
      }
    }

    // Parse the webhook event
    const event = adapter.parseWebhookPayload(payload, headers);
    if (!event) {
      logger.warn({ hotelId, payload }, 'Could not parse PMS webhook payload');
      return;
    }

    // Idempotency check
    const idempotencyKey = `${WEBHOOK_KEY_PREFIX}${hotelId}:${event.type}:${event.externalId}`;
    const exists = await redis.get(idempotencyKey);
    if (exists) {
      logger.debug({ hotelId, event: event.type, externalId: event.externalId }, 'Duplicate PMS webhook, skipping');
      return;
    }
    await redis.setex(idempotencyKey, WEBHOOK_IDEMPOTENCY_TTL, '1');

    logger.info({ hotelId, event: event.type, externalId: event.externalId }, 'Processing PMS webhook');

    // Fetch full reservation data and process
    try {
      const reservation = await adapter.getReservation(event.externalId);
      if (reservation) {
        // Use the sync service to process this single reservation
        await pmsSyncService.syncHotel(hotelId);
      } else {
        logger.warn({ hotelId, externalId: event.externalId }, 'PMS webhook: reservation not found');
      }
    } catch (err) {
      logger.error({ hotelId, event: event.type, error: err }, 'PMS webhook processing error');
    }
  }
}

export const pmsWebhookHandler = new PMSWebhookHandler();
