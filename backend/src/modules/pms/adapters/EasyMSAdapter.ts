import axios, { AxiosInstance } from 'axios';
import { HotelPMSConfig } from '@prisma/client';
import { BasePMSAdapter } from '../BasePMSAdapter';
import {
  PMSReservation,
  PMSReservationStatus,
  PMSRoomStatus,
  PMSGuestProfile,
  PMSFetchReservationsParams,
  PMSConnectionResult,
  PMSWebhookEvent,
  PMSError,
} from '../types';
import { logger } from '../../../shared/utils/logger';

// TODO: VERIFY_WITH_PMS_DOCS — EasyMS status codes mapping
const STATUS_MAP: Record<string, PMSReservationStatus> = {
  'confirmed': 'confirmed',
  'checked_in': 'checked_in',
  'checked_out': 'checked_out',
  'cancelled': 'cancelled',
  'no_show': 'no_show',
  // EasyMS-specific mappings
  'new': 'confirmed',
  'arrived': 'checked_in',
  'left': 'checked_out',
  'canceled': 'cancelled',
};

function mapStatus(raw: string): PMSReservationStatus {
  return STATUS_MAP[raw.toLowerCase()] || 'confirmed';
}

export class EasyMSAdapter extends BasePMSAdapter {
  private client: AxiosInstance;
  private baseUrl: string;
  private apiKey: string;

  constructor(config: HotelPMSConfig) {
    super(config);
    const creds = config.credentials as Record<string, string>;
    this.baseUrl = creds.baseUrl || '';
    this.apiKey = creds.apiKey || '';

    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      headers: {
        'X-Api-Key': this.apiKey,
        'Content-Type': 'application/json',
      },
    });
  }

  private async request<T>(method: 'GET' | 'POST' | 'PUT', path: string, data?: unknown, retries = 3): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        logger.debug({ method, path, attempt }, 'EasyMS API request');
        const response = await this.client.request<T>({ method, url: path, data });
        return response.data;
      } catch (err: unknown) {
        lastError = err instanceof Error ? err : new Error(String(err));
        logger.warn({ method, path, attempt, error: lastError.message }, 'EasyMS API request failed');

        if (attempt < retries) {
          const delay = Math.pow(2, attempt) * 500;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw new PMSError(
      `EasyMS API request failed after ${retries} attempts: ${lastError?.message}`,
      'EASYMS_REQUEST_FAILED',
    );
  }

  // TODO: VERIFY_WITH_PMS_DOCS — actual endpoint path and response format
  async fetchReservations(params: PMSFetchReservationsParams): Promise<PMSReservation[]> {
    const queryParams: Record<string, string> = {
      from: params.from.toISOString().split('T')[0],
      to: params.to.toISOString().split('T')[0],
    };
    if (params.updatedSince) {
      queryParams.modified_after = params.updatedSince.toISOString();
    }

    const queryString = new URLSearchParams(queryParams).toString();

    // TODO: VERIFY_WITH_PMS_DOCS — /api/v1/bookings endpoint
    const data = await this.request<{ bookings: EasyMSBooking[] }>(
      'GET',
      `/api/v1/bookings?${queryString}`,
    );

    return (data.bookings || []).map(b => this.mapReservation(b));
  }

  // TODO: VERIFY_WITH_PMS_DOCS — single booking endpoint
  async getReservation(externalId: string): Promise<PMSReservation | null> {
    try {
      const data = await this.request<{ booking: EasyMSBooking }>(
        'GET',
        `/api/v1/bookings/${externalId}`,
      );
      return data.booking ? this.mapReservation(data.booking) : null;
    } catch {
      return null;
    }
  }

  // TODO: VERIFY_WITH_PMS_DOCS — pre-check-in URL
  async getPreCheckinUrl(externalId: string): Promise<string | null> {
    try {
      const data = await this.request<{ precheckin_url?: string }>(
        'GET',
        `/api/v1/bookings/${externalId}/precheckin`,
      );
      return data.precheckin_url || null;
    } catch {
      return null;
    }
  }

  // TODO: VERIFY_WITH_PMS_DOCS — room statuses endpoint
  async fetchRoomStatuses(): Promise<PMSRoomStatus[]> {
    try {
      const data = await this.request<{ rooms: EasyMSRoom[] }>(
        'GET',
        `/api/v1/rooms`,
      );
      return (data.rooms || []).map(r => ({
        roomNumber: r.number,
        status: r.status as PMSRoomStatus['status'],
        roomType: r.type || 'standard',
      }));
    } catch {
      return [];
    }
  }

  // TODO: VERIFY_WITH_PMS_DOCS — guest profile endpoint
  async getGuestProfile(externalId: string): Promise<PMSGuestProfile | null> {
    try {
      const data = await this.request<{ guest: EasyMSGuest }>(
        'GET',
        `/api/v1/guests/${externalId}`,
      );
      if (!data.guest) return null;
      return {
        name: data.guest.name || `${data.guest.first_name || ''} ${data.guest.last_name || ''}`.trim(),
        email: data.guest.email,
        phone: data.guest.phone,
        nationality: data.guest.country,
      };
    } catch {
      return null;
    }
  }

  // TODO: VERIFY_WITH_PMS_DOCS — connection test
  async testConnection(): Promise<PMSConnectionResult> {
    try {
      await this.request('GET', '/api/v1/ping');
      return { ok: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, error: message };
    }
  }

  parseWebhookPayload(payload: unknown): PMSWebhookEvent | null {
    const body = payload as Record<string, unknown>;

    // TODO: VERIFY_WITH_PMS_DOCS — EasyMS webhook format
    const eventType = body.event || body.type;
    const bookingId = body.booking_id || body.id;

    if (!eventType || !bookingId) {
      logger.warn({ payload }, 'Unknown EasyMS webhook event format');
      return null;
    }

    const typeMap: Record<string, PMSWebhookEvent['type']> = {
      'booking.created': 'reservation_created',
      'booking.updated': 'reservation_updated',
      'booking.checkin': 'guest_checked_in',
      'booking.checkout': 'guest_checked_out',
      'guest.checkin': 'guest_checked_in',
      'guest.checkout': 'guest_checked_out',
    };

    const mappedType = typeMap[String(eventType)];
    if (!mappedType) {
      logger.warn({ eventType }, 'Unmapped EasyMS webhook event type');
      return null;
    }

    return {
      type: mappedType,
      externalId: String(bookingId),
      data: body as Record<string, unknown>,
    };
  }

  // TODO: VERIFY_WITH_PMS_DOCS — webhook signature verification
  verifyWebhookSignature(
    _payload: unknown,
    headers: Record<string, string | string[] | undefined>,
    secret: string,
  ): boolean {
    const signature = headers['x-easyms-signature'] || headers['x-webhook-signature'];
    if (!signature || !secret) return true;
    // TODO: Implement HMAC verification when EasyMS docs are available
    return true;
  }

  private mapReservation(b: EasyMSBooking): PMSReservation {
    return {
      externalId: String(b.id || b.booking_id),
      guestName: b.guest_name || `${b.first_name || ''} ${b.last_name || ''}`.trim() || 'Guest',
      guestEmail: b.email || b.guest_email,
      guestPhone: b.phone || b.guest_phone,
      roomNumber: b.room_number || b.room,
      roomType: b.room_type,
      checkIn: new Date(b.check_in || b.arrival || Date.now()),
      checkOut: new Date(b.check_out || b.departure || Date.now()),
      status: mapStatus(b.status || 'confirmed'),
      adults: b.adults || 1,
      children: b.children || 0,
      source: b.source || b.channel,
      totalAmount: b.total || b.amount,
      currency: b.currency || 'UAH',
      extras: b as unknown as Record<string, unknown>,
    };
  }
}

// TODO: VERIFY_WITH_PMS_DOCS — actual response types from EasyMS API
interface EasyMSBooking {
  id?: number;
  booking_id?: number;
  guest_name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  guest_email?: string;
  phone?: string;
  guest_phone?: string;
  room_number?: string;
  room?: string;
  room_type?: string;
  check_in?: string;
  check_out?: string;
  arrival?: string;
  departure?: string;
  status?: string;
  adults?: number;
  children?: number;
  source?: string;
  channel?: string;
  total?: number;
  amount?: number;
  currency?: string;
}

interface EasyMSRoom {
  number: string;
  status: string;
  type: string;
}

interface EasyMSGuest {
  name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  country?: string;
}
