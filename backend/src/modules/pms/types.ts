// ──── PMS Types ─────────────────────────────────

export interface PMSReservation {
  externalId: string;
  guestName: string;
  guestEmail?: string;
  guestPhone?: string;
  roomNumber?: string;
  roomType?: string;
  checkIn: Date;
  checkOut: Date;
  status: PMSReservationStatus;
  adults: number;
  children: number;
  source?: string;
  totalAmount?: number;
  currency?: string;
  extras?: Record<string, unknown>;
}

export type PMSReservationStatus =
  | 'confirmed'
  | 'checked_in'
  | 'checked_out'
  | 'cancelled'
  | 'no_show';

export interface PMSRoomStatus {
  roomNumber: string;
  status: 'vacant_clean' | 'vacant_dirty' | 'occupied' | 'out_of_order' | 'inspected';
  roomType: string;
}

export interface PMSGuestProfile {
  name: string;
  email?: string;
  phone?: string;
  nationality?: string;
  vipLevel?: number;
  previousStays?: number;
}

export interface PMSFetchReservationsParams {
  from: Date;
  to: Date;
  updatedSince?: Date;
}

export interface PMSConnectionResult {
  ok: boolean;
  error?: string;
}

export interface PMSWebhookEvent {
  type: 'reservation_created' | 'reservation_updated' | 'guest_checked_in' | 'guest_checked_out';
  externalId: string;
  data: Record<string, unknown>;
}

export interface SyncResult {
  hotelId: string;
  reservationsFound: number;
  created: number;
  updated: number;
  stageTransitions: number;
  errors: string[];
}

export class PMSError extends Error {
  constructor(
    message: string,
    public code: string = 'PMS_ERROR',
    public statusCode: number = 500,
  ) {
    super(message);
    this.name = 'PMSError';
  }
}
