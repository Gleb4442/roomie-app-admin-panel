// ──── SMS Types ─────────────────────────────────

export interface SMSSendParams {
  to: string;
  text: string;
  senderName?: string;
}

export interface SMSSendResult {
  externalId: string;
  status: string;
}

export type SMSDeliveryStatus = 'queued' | 'sent' | 'delivered' | 'failed';

export interface SMSConnectionResult {
  ok: boolean;
  error?: string;
}

export type TemplateKey =
  | 'booking_confirmation'
  | 'precheckin_invite'
  | 'app_download'
  | 'checkin_welcome'
  | 'checkout_thanks';

export interface TemplateContext {
  guestName: string;
  hotelName: string;
  checkIn?: string;
  checkOut?: string;
  roomNumber?: string;
  appLink?: string;
  preCheckinUrl?: string;
}

export class SMSError extends Error {
  constructor(
    message: string,
    public code: string = 'SMS_ERROR',
    public statusCode: number = 500,
  ) {
    super(message);
    this.name = 'SMSError';
  }
}
