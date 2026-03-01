import cron from 'node-cron';
import { prisma } from '../config/database';
import { syncMenuFromPOS } from '../modules/pos/menuSync.service';
import { logger } from '../shared/utils/logger';

// Sync POS menu every hour
cron.schedule('0 * * * *', async () => {
  const configs = await prisma.hotelPOSConfig.findMany({
    where: { syncEnabled: true },
  });

  for (const config of configs) {
    logger.info(`[POS Sync] Syncing hotel ${config.hotelId}...`);
    const result = await syncMenuFromPOS(config.hotelId);
    logger.info(
      `[POS Sync] Hotel ${config.hotelId}: ${result.synced} synced, ${result.errors.length} errors`,
    );
  }
});
