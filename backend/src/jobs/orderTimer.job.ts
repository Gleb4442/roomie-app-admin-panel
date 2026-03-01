import cron from 'node-cron';
import { processAutoTimerStatuses } from '../modules/orders/order.service';
import { logger } from '../shared/utils/logger';

// Process auto-timer statuses every 30 seconds
cron.schedule('*/30 * * * * *', async () => {
  try {
    await processAutoTimerStatuses();
  } catch (err) {
    logger.error(err, '[Order Timer] Error processing auto-timer statuses');
  }
});
