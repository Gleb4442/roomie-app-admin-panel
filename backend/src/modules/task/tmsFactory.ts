import { HotelTMSConfig } from '@prisma/client';
import { BaseTMSAdapter } from './adapters/BaseTMSAdapter';
import { HotelkitAdapter } from './adapters/HotelkitAdapter';
import { FlexkeepingAdapter } from './adapters/FlexkeepingAdapter';
import { BuiltInAdapter } from './adapters/BuiltInAdapter';
import { GenericWebhookAdapter } from './adapters/GenericWebhookAdapter';

export class TMSFactory {
  static createAdapter(config: HotelTMSConfig): BaseTMSAdapter {
    const creds = config.credentials as Record<string, string>;

    switch (config.provider) {
      case 'hotelkit':
        return new HotelkitAdapter({ apiKey: creds.apiKey, baseUrl: creds.baseUrl });
      case 'flexkeeping':
        return new FlexkeepingAdapter({ apiKey: creds.apiKey, baseUrl: creds.baseUrl });
      case 'generic_webhook':
        return new GenericWebhookAdapter({
          webhookUrl: config.outgoingWebhookUrl || creds.webhookUrl,
          webhookSecret: config.webhookSecret || creds.webhookSecret,
        });
      case 'built_in':
      case 'none':
        return new BuiltInAdapter();
      default:
        throw new Error(`Unsupported TMS provider: ${config.provider}`);
    }
  }
}
