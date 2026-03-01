import 'dotenv/config';
import app from './app';
import { env } from './config/environment';
import { logger } from './shared/utils/logger';

app.listen(env.port, '0.0.0.0', () => {
  logger.info(`Server running on port ${env.port} [${env.nodeEnv}]`);
});
