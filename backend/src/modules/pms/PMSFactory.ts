import { HotelPMSConfig } from '@prisma/client';
import { BasePMSAdapter } from './BasePMSAdapter';
import { ServioAdapter } from './adapters/ServioAdapter';
import { EasyMSAdapter } from './adapters/EasyMSAdapter';
import { PMSError } from './types';

export class PMSFactory {
  static create(config: HotelPMSConfig): BasePMSAdapter {
    switch (config.pmsType.toLowerCase()) {
      case 'servio':
        return new ServioAdapter(config);
      case 'easyms':
        return new EasyMSAdapter(config);
      default:
        throw new PMSError(
          `Unsupported PMS provider: ${config.pmsType}`,
          'UNSUPPORTED_PMS',
          400,
        );
    }
  }
}
