import { prisma } from '../../config/database';
import { redis } from '../../config/redis';
import { logger } from '../../shared/utils/logger';
import { PMSFactory } from './PMSFactory';
import { PMSReservation, SyncResult } from './types';
import { GuestStay, JourneyStage, Prisma } from '@prisma/client';

export class PMSSyncService {
  /**
   * Sync a single hotel's PMS reservations.
   * Called by cron every 15 min or manually triggered.
   */
  async syncHotel(hotelId: string): Promise<SyncResult> {
    const result: SyncResult = {
      hotelId,
      reservationsFound: 0,
      created: 0,
      updated: 0,
      stageTransitions: 0,
      errors: [],
    };

    const pmsConfig = await prisma.hotelPMSConfig.findUnique({
      where: { hotelId },
    });

    if (!pmsConfig || !pmsConfig.isActive || !pmsConfig.syncEnabled) {
      logger.debug({ hotelId }, 'PMS sync skipped: not configured or disabled');
      return result;
    }

    const adapter = PMSFactory.create(pmsConfig);

    const now = new Date();
    const from = pmsConfig.lastSyncAt || new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days back
    const to = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000); // 90 days forward

    try {
      const reservations = await adapter.fetchReservations({
        from,
        to,
        updatedSince: pmsConfig.lastSyncAt || undefined,
      });

      result.reservationsFound = reservations.length;
      logger.info({ hotelId, count: reservations.length }, 'PMS reservations fetched');

      for (const reservation of reservations) {
        try {
          await this.processReservation(hotelId, reservation, pmsConfig.pmsType, result);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          result.errors.push(`Reservation ${reservation.externalId}: ${msg}`);
          logger.error({ hotelId, externalId: reservation.externalId, error: msg }, 'Failed to process reservation');
        }
      }

      // Update lastSyncAt
      await prisma.hotelPMSConfig.update({
        where: { hotelId },
        data: { lastSyncAt: now },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`Fetch failed: ${msg}`);
      logger.error({ hotelId, error: msg }, 'PMS sync fetch failed');
    }

    return result;
  }

  /**
   * Sync all hotels with active PMS configs.
   * Uses Promise.allSettled so one hotel's failure won't block others.
   */
  async syncAll(): Promise<void> {
    const configs = await prisma.hotelPMSConfig.findMany({
      where: { isActive: true, syncEnabled: true },
      select: { hotelId: true },
    });

    if (configs.length === 0) {
      logger.debug('No hotels configured for PMS sync');
      return;
    }

    logger.info({ count: configs.length }, 'Starting PMS sync for all hotels');

    const results = await Promise.allSettled(
      configs.map(c => this.syncHotel(c.hotelId)),
    );

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const hotelId = configs[i].hotelId;
      if (result.status === 'rejected') {
        logger.error({ hotelId, error: result.reason }, 'PMS sync failed for hotel');
      } else {
        const { hotelId: _, ...syncData } = result.value;
        logger.info({ hotelId, ...syncData }, 'PMS sync completed for hotel');
      }
    }
  }

  /**
   * Process a single reservation: find or create guest, upsert stay, handle stage transitions.
   */
  private async processReservation(
    hotelId: string,
    reservation: PMSReservation,
    pmsProvider: string,
    result: SyncResult,
  ): Promise<void> {
    // Check if stay already exists by externalReservationId
    let stay = await prisma.guestStay.findUnique({
      where: { externalReservationId: reservation.externalId },
    });

    if (stay) {
      // Update existing stay
      const newStage = this.mapPMSStatusToStage(reservation.status);
      const stageChanged = stay.stage !== newStage;

      await prisma.guestStay.update({
        where: { id: stay.id },
        data: {
          roomNumber: reservation.roomNumber || stay.roomNumber,
          roomType: reservation.roomType || stay.roomType,
          checkIn: reservation.checkIn,
          checkOut: reservation.checkOut,
          pmsRawData: (reservation.extras as Prisma.InputJsonValue) ?? Prisma.JsonNull,
          source: reservation.source || stay.source,
          stage: newStage,
        },
      });

      if (stageChanged) {
        await this.recordStageTransition(stay.id, stay.stage, newStage, 'pms_sync');
        await this.publishStageChange(stay, newStage, hotelId);
        result.stageTransitions++;

        // Update room housekeeping status on checkout/checkin
        const roomNumber = reservation.roomNumber || stay.roomNumber;
        if (reservation.status === 'checked_out') {
          this.handleRoomEvent(hotelId, 'checkout', roomNumber ?? undefined).catch(() => {});
        } else if (reservation.status === 'checked_in') {
          this.handleRoomEvent(hotelId, 'checkin', roomNumber ?? undefined).catch(() => {});
        }
      }

      result.updated++;
    } else {
      // Find or create guest
      const guest = await this.findOrCreateGuest(reservation, hotelId);

      // Determine initial stage
      const stage = this.mapPMSStatusToStage(reservation.status);

      // Create GuestStay
      stay = await prisma.guestStay.create({
        data: {
          guestId: guest.id,
          hotelId,
          externalReservationId: reservation.externalId,
          pmsProvider,
          bookingRef: reservation.externalId,
          stage,
          roomNumber: reservation.roomNumber,
          roomType: reservation.roomType,
          checkIn: reservation.checkIn,
          checkOut: reservation.checkOut,
          enteredVia: 'sms_booking',
          source: reservation.source,
          pmsRawData: (reservation.extras as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        },
      });

      // Ensure guest-hotel link
      await prisma.guestHotel.upsert({
        where: { guestId_hotelId: { guestId: guest.id, hotelId } },
        update: {},
        create: { guestId: guest.id, hotelId, source: 'sms_booking' },
      });

      // Record initial stage transition
      await this.recordStageTransition(stay.id, 'BETWEEN_STAYS', stage, 'pms_sync');

      result.created++;
    }
  }

  /**
   * Find existing guest by email or phone, or create a new one.
   */
  private async findOrCreateGuest(data: PMSReservation, hotelId: string) {
    // Try by email first
    if (data.guestEmail) {
      const existing = await prisma.guestAccount.findUnique({
        where: { email: data.guestEmail },
      });
      if (existing) return existing;
    }

    // Try by phone (normalized)
    if (data.guestPhone) {
      const normalizedPhone = this.normalizePhone(data.guestPhone);
      const existing = await prisma.guestAccount.findFirst({
        where: { phone: normalizedPhone },
      });
      if (existing) return existing;
    }

    // Create new guest
    const nameParts = data.guestName.split(' ');
    const firstName = nameParts[0] || 'Guest';
    const lastName = nameParts.slice(1).join(' ') || undefined;

    return prisma.guestAccount.create({
      data: {
        email: data.guestEmail || `pms_${Date.now()}_${Math.random().toString(36).slice(2)}@placeholder.local`,
        firstName,
        lastName,
        phone: data.guestPhone ? this.normalizePhone(data.guestPhone) : undefined,
        createdVia: 'sms_booking',
      },
    });
  }

  /**
   * Map PMS reservation status to our JourneyStage enum.
   */
  private mapPMSStatusToStage(status: PMSReservation['status']): JourneyStage {
    switch (status) {
      case 'confirmed':
        return 'PRE_ARRIVAL';
      case 'checked_in':
        return 'IN_STAY';
      case 'checked_out':
        return 'POST_STAY';
      case 'cancelled':
      case 'no_show':
        return 'BETWEEN_STAYS';
      default:
        return 'PRE_ARRIVAL';
    }
  }

  /**
   * Trigger housekeeping room status update on PMS checkout/checkin.
   * Called from webhook handler or after processReservation detects a stage change.
   */
  async handleRoomEvent(hotelId: string, event: 'checkout' | 'checkin', roomNumber?: string): Promise<void> {
    if (!roomNumber) return;
    try {
      const { roomService } = await import('../housekeeping/room.service');
      if (event === 'checkout') {
        await roomService.handleCheckout(hotelId, roomNumber);
      } else {
        await roomService.handleCheckin(hotelId, roomNumber);
      }
    } catch (err) {
      logger.warn({ err, hotelId, roomNumber, event }, '[PMS] Failed to update room status');
    }
  }

  /**
   * Record a stage transition in the log.
   */
  private async recordStageTransition(
    guestStayId: string,
    fromStage: string,
    toStage: string,
    reason: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await prisma.stageTransition.create({
      data: {
        guestStayId,
        fromStage,
        toStage,
        reason,
        metadata: (metadata as Prisma.InputJsonValue) ?? undefined,
      },
    });
  }

  /**
   * Publish stage change event via Redis pub/sub.
   */
  private async publishStageChange(
    stay: GuestStay,
    toStage: string,
    hotelId: string,
  ): Promise<void> {
    try {
      await redis.publish('guest-journey', JSON.stringify({
        type: 'stage_changed',
        guestStayId: stay.id,
        guestId: stay.guestId,
        hotelId,
        fromStage: stay.stage,
        toStage,
        timestamp: new Date().toISOString(),
      }));
    } catch (err) {
      logger.warn({ err }, 'Failed to publish stage change event');
    }
  }

  /**
   * Normalize phone number: remove spaces, parentheses, dashes.
   */
  private normalizePhone(phone: string): string {
    let normalized = phone.replace(/[\s()\-\.]/g, '');
    if (!normalized.startsWith('+')) {
      // Assume Ukrainian number if starts with 0
      if (normalized.startsWith('0')) {
        normalized = '+38' + normalized;
      } else if (normalized.startsWith('38')) {
        normalized = '+' + normalized;
      }
    }
    return normalized;
  }
}

export const pmsSyncService = new PMSSyncService();
