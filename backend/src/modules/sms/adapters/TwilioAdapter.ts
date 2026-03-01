import Twilio from 'twilio';
import { HotelSMSConfig } from '@prisma/client';
import { BaseSMSAdapter } from '../BaseSMSAdapter';
import { SMSSendParams, SMSSendResult, SMSDeliveryStatus, SMSConnectionResult, SMSError } from '../types';
import { logger } from '../../../shared/utils/logger';

export class TwilioAdapter extends BaseSMSAdapter {
  private client: Twilio.Twilio;
  private fromNumber: string;

  constructor(config: HotelSMSConfig) {
    super(config);
    const creds = config.credentials as Record<string, string>;
    const accountSid = creds.accountSid;
    const authToken = creds.authToken;
    this.fromNumber = creds.fromNumber || '';

    if (!accountSid || !authToken) {
      throw new SMSError('Twilio credentials missing: accountSid, authToken required', 'TWILIO_CONFIG_ERROR');
    }

    this.client = Twilio(accountSid, authToken);
  }

  async send(params: SMSSendParams): Promise<SMSSendResult> {
    try {
      logger.debug({ to: params.to }, 'Sending SMS via Twilio');

      const message = await this.client.messages.create({
        to: params.to,
        from: this.fromNumber,
        body: params.text,
      });

      return {
        externalId: message.sid,
        status: message.status,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error({ to: params.to, error: msg }, 'Twilio SMS send failed');
      throw new SMSError(`Twilio send failed: ${msg}`, 'TWILIO_SEND_FAILED');
    }
  }

  async getStatus(externalId: string): Promise<SMSDeliveryStatus> {
    try {
      const message = await this.client.messages(externalId).fetch();

      const statusMap: Record<string, SMSDeliveryStatus> = {
        queued: 'queued',
        sending: 'sent',
        sent: 'sent',
        delivered: 'delivered',
        failed: 'failed',
        undelivered: 'failed',
      };

      return statusMap[message.status] || 'queued';
    } catch {
      return 'failed';
    }
  }

  async testConnection(): Promise<SMSConnectionResult> {
    try {
      // Verify account by fetching account info
      const account = await this.client.api.accounts(
        (this.config.credentials as Record<string, string>).accountSid,
      ).fetch();

      return { ok: account.status === 'active' };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, error: msg };
    }
  }
}
