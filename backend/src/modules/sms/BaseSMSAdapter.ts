import { HotelSMSConfig } from '@prisma/client';
import { SMSSendParams, SMSSendResult, SMSDeliveryStatus, SMSConnectionResult } from './types';

export abstract class BaseSMSAdapter {
  constructor(protected config: HotelSMSConfig) {}

  abstract send(params: SMSSendParams): Promise<SMSSendResult>;

  abstract getStatus(externalId: string): Promise<SMSDeliveryStatus>;

  abstract testConnection(): Promise<SMSConnectionResult>;
}
