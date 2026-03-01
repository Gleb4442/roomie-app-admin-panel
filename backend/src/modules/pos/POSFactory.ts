import { POSAdapter } from './POSAdapter';
import { PosterAdapter } from './adapters/PosterAdapter';

export class POSFactory {
  static createAdapter(
    config: {
      posType: string;
      apiUrl: string;
      accessToken: string;
      spotId?: string | null;
    } | null,
  ): POSAdapter | null {
    if (!config) return null;

    switch (config.posType) {
      case 'poster':
        return new PosterAdapter({
          apiUrl: config.apiUrl,
          accessToken: config.accessToken,
          spotId: config.spotId || undefined,
        });
      default:
        console.warn(`POS adapter '${config.posType}' not implemented`);
        return null;
    }
  }
}
