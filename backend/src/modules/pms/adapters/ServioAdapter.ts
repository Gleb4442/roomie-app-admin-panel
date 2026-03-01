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

// TODO: VERIFY_WITH_PMS_DOCS — Servio status codes mapping
const STATUS_MAP: Record<string, PMSReservationStatus> = {
  'confirmed': 'confirmed',
  'checked_in': 'checked_in',
  'checked_out': 'checked_out',
  'cancelled': 'cancelled',
  'no_show': 'no_show',
  // Servio-specific mappings
  'reserved': 'confirmed',
  'in_house': 'checked_in',
  'departed': 'checked_out',
  'canceled': 'cancelled',
  'noshow': 'no_show',
};

function mapStatus(raw: string): PMSReservationStatus {
  return STATUS_MAP[raw.toLowerCase()] || 'confirmed';
}

export class ServioAdapter extends BasePMSAdapter {
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
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
    });
  }

  private async request<T>(method: 'GET' | 'POST' | 'PUT', path: string, data?: unknown, retries = 3): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        logger.debug({ method, path, attempt }, 'Servio API request');
        const response = await this.client.request<T>({ method, url: path, data });
        return response.data;
      } catch (err: unknown) {
        lastError = err instanceof Error ? err : new Error(String(err));
        logger.warn({ method, path, attempt, error: lastError.message }, 'Servio API request failed');

        if (attempt < retries) {
          const delay = Math.pow(2, attempt) * 500;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw new PMSError(
      `Servio API request failed after ${retries} attempts: ${lastError?.message}`,
      'SERVIO_REQUEST_FAILED',
    );
  }

  // TODO: VERIFY_WITH_PMS_DOCS — actual endpoint path and response format
  async fetchReservations(params: PMSFetchReservationsParams): Promise<PMSReservation[]> {
    const queryParams: Record<string, string> = {
      date_from: params.from.toISOString().split('T')[0],
      date_to: params.to.toISOString().split('T')[0],
    };
    if (params.updatedSince) {
      queryParams.updated_since = params.updatedSince.toISOString();
    }
    if (this.config.pmsHotelId) {
      queryParams.hotel_id = this.config.pmsHotelId;
    }

    const queryString = new URLSearchParams(queryParams).toString();

    // TODO: VERIFY_WITH_PMS_DOCS — /api/reservations endpoint
    const data = await this.request<{ reservations: ServioReservation[] }>(
      'GET',
      `/api/reservations?${queryString}`,
    );

    return (data.reservations || []).map(r => this.mapReservation(r));
  }

  // TODO: VERIFY_WITH_PMS_DOCS — single reservation endpoint
  async getReservation(externalId: string): Promise<PMSReservation | null> {
    try {
      const data = await this.request<{ reservation: ServioReservation }>(
        'GET',
        `/api/reservations/${externalId}`,
      );
      return data.reservation ? this.mapReservation(data.reservation) : null;
    } catch {
      return null;
    }
  }

  // TODO: VERIFY_WITH_PMS_DOCS — pre-check-in URL generation
  async getPreCheckinUrl(externalId: string): Promise<string | null> {
    try {
      const data = await this.request<{ url?: string }>(
        'GET',
        `/api/reservations/${externalId}/precheckin-url`,
      );
      return data.url || null;
    } catch {
      return null;
    }
  }

  // TODO: VERIFY_WITH_PMS_DOCS — room statuses endpoint
  async fetchRoomStatuses(): Promise<PMSRoomStatus[]> {
    try {
      const data = await this.request<{ rooms: ServioRoom[] }>(
        'GET',
        `/api/rooms/status`,
      );
      return (data.rooms || []).map(r => ({
        roomNumber: r.number || r.room_number,
        status: r.status as PMSRoomStatus['status'],
        roomType: r.room_type || r.category || 'standard',
      }));
    } catch {
      return [];
    }
  }

  // TODO: VERIFY_WITH_PMS_DOCS — guest profile endpoint
  async getGuestProfile(externalId: string): Promise<PMSGuestProfile | null> {
    try {
      const data = await this.request<{ guest: ServioGuest }>(
        'GET',
        `/api/guests/${externalId}`,
      );
      if (!data.guest) return null;
      return {
        name: `${data.guest.first_name || ''} ${data.guest.last_name || ''}`.trim(),
        email: data.guest.email,
        phone: data.guest.phone,
        nationality: data.guest.nationality,
        vipLevel: data.guest.vip_level,
        previousStays: data.guest.previous_stays,
      };
    } catch {
      return null;
    }
  }

  // TODO: VERIFY_WITH_PMS_DOCS — connection test endpoint
  async testConnection(): Promise<PMSConnectionResult> {
    try {
      await this.request('GET', '/api/health');
      return { ok: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, error: message };
    }
  }

  parseWebhookPayload(payload: unknown): PMSWebhookEvent | null {
    const body = payload as Record<string, unknown>;

    // TODO: VERIFY_WITH_PMS_DOCS — Servio webhook format
    // Known format: { "Add": { "Guests": [23061] } } for v06.00.096+
    if (body.Add && typeof body.Add === 'object') {
      const add = body.Add as Record<string, unknown>;
      if (Array.isArray(add.Guests) && add.Guests.length > 0) {
        return {
          type: 'reservation_created',
          externalId: String(add.Guests[0]),
          data: body as Record<string, unknown>,
        };
      }
    }

    if (body.Update && typeof body.Update === 'object') {
      const update = body.Update as Record<string, unknown>;
      if (Array.isArray(update.Guests) && update.Guests.length > 0) {
        return {
          type: 'reservation_updated',
          externalId: String(update.Guests[0]),
          data: body as Record<string, unknown>,
        };
      }
    }

    if (body.CheckIn && typeof body.CheckIn === 'object') {
      const checkin = body.CheckIn as Record<string, unknown>;
      return {
        type: 'guest_checked_in',
        externalId: String(checkin.reservation_id || checkin.guest_id || ''),
        data: body as Record<string, unknown>,
      };
    }

    if (body.CheckOut && typeof body.CheckOut === 'object') {
      const checkout = body.CheckOut as Record<string, unknown>;
      return {
        type: 'guest_checked_out',
        externalId: String(checkout.reservation_id || checkout.guest_id || ''),
        data: body as Record<string, unknown>,
      };
    }

    logger.warn({ payload }, 'Unknown Servio webhook event format');
    return null;
  }

  // TODO: VERIFY_WITH_PMS_DOCS — webhook signature verification
  verifyWebhookSignature(
    _payload: unknown,
    headers: Record<string, string | string[] | undefined>,
    secret: string,
  ): boolean {
    const signature = headers['x-servio-signature'] || headers['x-webhook-signature'];
    if (!signature || !secret) return true; // Skip verification if no secret configured
    // TODO: Implement HMAC verification when Servio docs are available
    return true;
  }

  private mapReservation(r: ServioReservation): PMSReservation {
    return {
      externalId: String(r.id || r.reservation_id),
      guestName: `${r.guest_first_name || r.first_name || ''} ${r.guest_last_name || r.last_name || ''}`.trim() || 'Guest',
      guestEmail: r.email || r.guest_email,
      guestPhone: r.phone || r.guest_phone,
      roomNumber: r.room_number || r.room,
      roomType: r.room_type || r.category,
      checkIn: new Date(r.check_in || r.arrival_date || Date.now()),
      checkOut: new Date(r.check_out || r.departure_date || Date.now()),
      status: mapStatus(r.status || 'confirmed'),
      adults: r.adults || 1,
      children: r.children || 0,
      source: r.source || r.channel,
      totalAmount: r.total_amount || r.amount,
      currency: r.currency || 'UAH',
      extras: r as unknown as Record<string, unknown>,
    };
  }
}

// TODO: VERIFY_WITH_PMS_DOCS — actual response types from Servio API
interface ServioReservation {
  id?: number;
  reservation_id?: number;
  guest_first_name?: string;
  guest_last_name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  guest_email?: string;
  phone?: string;
  guest_phone?: string;
  room_number?: string;
  room?: string;
  room_type?: string;
  category?: string;
  check_in?: string;
  check_out?: string;
  arrival_date?: string;
  departure_date?: string;
  status?: string;
  adults?: number;
  children?: number;
  source?: string;
  channel?: string;
  total_amount?: number;
  amount?: number;
  currency?: string;
}

interface ServioRoom {
  number: string;
  room_number: string;
  status: string;
  room_type: string;
  category: string;
}

interface ServioGuest {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  nationality?: string;
  vip_level?: number;
  previous_stays?: number;
}
