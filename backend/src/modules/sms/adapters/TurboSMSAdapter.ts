import axios, { AxiosInstance } from 'axios';
import { HotelSMSConfig } from '@prisma/client';
import { BaseSMSAdapter } from '../BaseSMSAdapter';
import { SMSSendParams, SMSSendResult, SMSDeliveryStatus, SMSConnectionResult, SMSError } from '../types';
import { logger } from '../../../shared/utils/logger';

const TURBOSMS_API_URL = 'https://api.turbosms.ua';

export class TurboSMSAdapter extends BaseSMSAdapter {
  private client: AxiosInstance;

  constructor(config: HotelSMSConfig) {
    super(config);
    const creds = config.credentials as Record<string, string>;
    const apiKey = creds.apiKey;

    if (!apiKey) {
      throw new SMSError('TurboSMS credentials missing: apiKey required', 'TURBOSMS_CONFIG_ERROR');
    }

    this.client = axios.create({
      baseURL: TURBOSMS_API_URL,
      timeout: 15000,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });
  }

  async send(params: SMSSendParams): Promise<SMSSendResult> {
    try {
      logger.debug({ to: params.to }, 'Sending SMS via TurboSMS');

      const response = await this.client.post('/message/send.json', {
        recipients: [params.to],
        sms: {
          sender: params.senderName || this.config.senderName,
          text: params.text,
        },
      });

      const data = response.data;

      if (data.response_code !== 0 && data.response_code !== 800) {
        throw new SMSError(
          `TurboSMS error: ${data.response_status || 'Unknown error'}`,
          'TURBOSMS_SEND_FAILED',
        );
      }

      const messageId = data.response_result?.[0]?.message_id || data.message_id || `turbosms_${Date.now()}`;

      return {
        externalId: String(messageId),
        status: 'sent',
      };
    } catch (err: unknown) {
      if (err instanceof SMSError) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      logger.error({ to: params.to, error: msg }, 'TurboSMS send failed');
      throw new SMSError(`TurboSMS send failed: ${msg}`, 'TURBOSMS_SEND_FAILED');
    }
  }

  async getStatus(externalId: string): Promise<SMSDeliveryStatus> {
    try {
      const response = await this.client.post('/message/status.json', {
        messages: [externalId],
      });

      const data = response.data;
      const status = data.response_result?.[0]?.status;

      const statusMap: Record<string, SMSDeliveryStatus> = {
        DELIVERED: 'delivered',
        SENT: 'sent',
        ACCEPTD: 'sent',
        ENROUTE: 'sent',
        UNDELIV: 'failed',
        REJECTD: 'failed',
        EXPIRED: 'failed',
      };

      return statusMap[status] || 'queued';
    } catch {
      return 'failed';
    }
  }

  async testConnection(): Promise<SMSConnectionResult> {
    try {
      const response = await this.client.get('/user/balance.json');
      const data = response.data;

      if (data.response_code === 0 || data.response_code === 800) {
        return { ok: true };
      }

      return { ok: false, error: data.response_status || 'Unknown error' };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, error: msg };
    }
  }
}
