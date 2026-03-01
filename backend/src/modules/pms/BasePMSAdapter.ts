import { HotelPMSConfig } from '@prisma/client';
import {
  PMSReservation,
  PMSRoomStatus,
  PMSGuestProfile,
  PMSFetchReservationsParams,
  PMSConnectionResult,
  PMSWebhookEvent,
} from './types';

export abstract class BasePMSAdapter {
  constructor(protected config: HotelPMSConfig) {}

  abstract fetchReservations(params: PMSFetchReservationsParams): Promise<PMSReservation[]>;

  abstract getReservation(externalId: string): Promise<PMSReservation | null>;

  abstract getPreCheckinUrl(externalId: string): Promise<string | null>;

  abstract fetchRoomStatuses(): Promise<PMSRoomStatus[]>;

  abstract getGuestProfile(externalId: string): Promise<PMSGuestProfile | null>;

  abstract testConnection(): Promise<PMSConnectionResult>;

  abstract parseWebhookPayload(payload: unknown, headers: Record<string, string | string[] | undefined>): PMSWebhookEvent | null;

  abstract verifyWebhookSignature(payload: unknown, headers: Record<string, string | string[] | undefined>, secret: string): boolean;
}
