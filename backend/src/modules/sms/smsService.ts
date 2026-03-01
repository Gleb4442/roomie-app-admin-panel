import { prisma } from '../../config/database';
import { redis } from '../../config/redis';
import { logger } from '../../shared/utils/logger';
import { SMSFactory } from './SMSFactory';
import { renderTemplate } from './smsTemplates';
import { TemplateKey, TemplateContext } from './types';
import { smsQueue } from './smsQueue';
import { GuestStay } from '@prisma/client';

const SMS_DEDUP_PREFIX = 'sms:';
const SMS_DEDUP_TTL = 86400; // 24 hours

export class SMSService {
  /**
   * Send an SMS with deduplication and logging.
   */
  async send(params: {
    hotelId: string;
    guestId?: string;
    guestStayId?: string;
    phone: string;
    template: TemplateKey;
    context: TemplateContext;
    language?: string;
    delayMs?: number;
  }): Promise<void> {
    // 1. Check if hotel has SMS configured and enabled
    const smsConfig = await prisma.hotelSMSConfig.findUnique({
      where: { hotelId: params.hotelId },
    });

    if (!smsConfig || !smsConfig.enabled) {
      logger.debug({ hotelId: params.hotelId }, 'SMS not configured or disabled for hotel');
      return;
    }

    // 2. Deduplication: check if already sent for this stay + template
    if (params.guestStayId) {
      const dedupKey = `${SMS_DEDUP_PREFIX}${params.guestStayId}:${params.template}`;
      const exists = await redis.get(dedupKey);
      if (exists) {
        logger.debug({ guestStayId: params.guestStayId, template: params.template }, 'SMS deduplicated, skipping');
        return;
      }
      await redis.setex(dedupKey, SMS_DEDUP_TTL, '1');
    }

    // 3. Normalize phone
    const phone = this.normalizePhone(params.phone);
    if (!phone) {
      logger.warn({ phone: params.phone }, 'Invalid phone number, skipping SMS');
      return;
    }

    // 4. Render template
    const language = params.language || 'uk';
    const text = renderTemplate(params.template, language, params.context);

    // 5. Create SMS log entry
    const smsLog = await prisma.sMSLog.create({
      data: {
        hotelId: params.hotelId,
        guestId: params.guestId,
        guestStayId: params.guestStayId,
        phone,
        template: params.template,
        provider: smsConfig.provider,
        status: 'queued',
      },
    });

    // 6. Add to queue
    await smsQueue.add(
      'send-sms',
      {
        hotelId: params.hotelId,
        phone,
        text,
        smsLogId: smsLog.id,
        senderName: smsConfig.senderName,
      },
      {
        delay: params.delayMs || 0,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      },
    );

    logger.info({
      hotelId: params.hotelId,
      template: params.template,
      phone,
      smsLogId: smsLog.id,
    }, 'SMS queued for sending');
  }

  /**
   * Trigger SMS based on stage transitions.
   */
  async triggerForStageTransition(
    stay: GuestStay & { guest?: { firstName: string; phone?: string | null; preferences?: unknown }; hotel?: { name: string } },
    fromStage: string,
    toStage: string,
  ): Promise<void> {
    // Get guest and hotel info
    const guest = stay.guest || await prisma.guestAccount.findUnique({
      where: { id: stay.guestId },
    });
    const hotel = stay.hotel || await prisma.hotel.findUnique({
      where: { id: stay.hotelId },
    });

    if (!guest || !hotel) {
      logger.warn({ stayId: stay.id }, 'Cannot trigger SMS: guest or hotel not found');
      return;
    }

    if (!guest.phone) {
      logger.debug({ stayId: stay.id }, 'Cannot trigger SMS: guest has no phone');
      return;
    }

    const appLink = `roomie://open?source=sms_booking&hotel=${stay.hotelId}&stayId=${stay.id}`;
    const baseContext: TemplateContext = {
      guestName: guest.firstName,
      hotelName: hotel.name,
      checkIn: stay.checkIn ? formatDate(stay.checkIn) : undefined,
      checkOut: stay.checkOut ? formatDate(stay.checkOut) : undefined,
      roomNumber: stay.roomNumber || undefined,
      appLink,
    };

    const language = (guest.preferences as Record<string, string> | null)?.language || 'uk';

    // New booking: BETWEEN_STAYS → PRE_ARRIVAL
    if (fromStage === 'BETWEEN_STAYS' && toStage === 'PRE_ARRIVAL') {
      // Immediate: booking confirmation
      await this.send({
        hotelId: stay.hotelId,
        guestId: stay.guestId,
        guestStayId: stay.id,
        phone: guest.phone,
        template: 'booking_confirmation',
        context: baseContext,
        language,
      });

      // +1 hour: pre-check-in invite
      if (stay.preCheckinUrl) {
        await this.send({
          hotelId: stay.hotelId,
          guestId: stay.guestId,
          guestStayId: stay.id,
          phone: guest.phone,
          template: 'precheckin_invite',
          context: { ...baseContext, preCheckinUrl: stay.preCheckinUrl },
          language,
          delayMs: 60 * 60 * 1000, // 1 hour
        });
      }

      // +24 hours: app download
      await this.send({
        hotelId: stay.hotelId,
        guestId: stay.guestId,
        guestStayId: stay.id,
        phone: guest.phone,
        template: 'app_download',
        context: baseContext,
        language,
        delayMs: 24 * 60 * 60 * 1000, // 24 hours
      });
    }

    // Check-in: PRE_ARRIVAL → IN_STAY
    if (fromStage === 'PRE_ARRIVAL' && toStage === 'IN_STAY') {
      await this.send({
        hotelId: stay.hotelId,
        guestId: stay.guestId,
        guestStayId: stay.id,
        phone: guest.phone,
        template: 'checkin_welcome',
        context: baseContext,
        language,
      });
    }

    // Check-out: IN_STAY → POST_STAY
    if (fromStage === 'IN_STAY' && toStage === 'POST_STAY') {
      await this.send({
        hotelId: stay.hotelId,
        guestId: stay.guestId,
        guestStayId: stay.id,
        phone: guest.phone,
        template: 'checkout_thanks',
        context: baseContext,
        language,
      });
    }
  }

  private normalizePhone(phone: string): string {
    let normalized = phone.replace(/[\s()\-\.]/g, '');
    if (!normalized.startsWith('+')) {
      if (normalized.startsWith('0')) {
        normalized = '+38' + normalized;
      } else if (normalized.startsWith('38')) {
        normalized = '+' + normalized;
      }
    }
    return normalized;
  }
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export const smsService = new SMSService();
