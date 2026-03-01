import { HotelSMSConfig } from '@prisma/client';
import { BaseSMSAdapter } from './BaseSMSAdapter';
import { TwilioAdapter } from './adapters/TwilioAdapter';
import { TurboSMSAdapter } from './adapters/TurboSMSAdapter';
import { SMSError } from './types';

export class SMSFactory {
  static create(config: HotelSMSConfig): BaseSMSAdapter {
    switch (config.provider.toLowerCase()) {
      case 'twilio':
        return new TwilioAdapter(config);
      case 'turbosms':
        return new TurboSMSAdapter(config);
      default:
        throw new SMSError(
          `Unsupported SMS provider: ${config.provider}`,
          'UNSUPPORTED_SMS_PROVIDER',
          400,
        );
    }
  }
}
