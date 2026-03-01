import { HotelTMSConfig } from '@prisma/client';
import { BaseTMSAdapter } from './adapters/BaseTMSAdapter';
import { HotelkitAdapter } from './adapters/HotelkitAdapter';
import { FlexkeepingAdapter } from './adapters/FlexkeepingAdapter';

export class TMSFactory {
  static createAdapter(config: HotelTMSConfig): BaseTMSAdapter {
    const creds = config.credentials as Record<string, string>;

    switch (config.provider) {
      case 'hotelkit':
        return new HotelkitAdapter({ apiKey: creds.apiKey, baseUrl: creds.baseUrl });
      case 'flexkeeping':
        return new FlexkeepingAdapter({ apiKey: creds.apiKey, baseUrl: creds.baseUrl });
      default:
        throw new Error(`Unsupported TMS provider: ${config.provider}`);
    }
  }
}
