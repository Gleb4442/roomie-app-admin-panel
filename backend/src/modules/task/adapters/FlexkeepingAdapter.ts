import { BaseTMSAdapter } from './BaseTMSAdapter';
import { TMSTask } from '../types';
import { logger } from '../../../shared/utils/logger';

export class FlexkeepingAdapter extends BaseTMSAdapter {
  constructor(private config: { apiKey: string; baseUrl: string }) {
    super();
  }

  async createTask(task: TMSTask): Promise<{ externalId: string }> {
    // TODO: POST ${this.config.baseUrl}/api/tasks
    logger.info({ task: task.title }, '[FlexkeepingAdapter] createTask — stub');
    return { externalId: `flexkeeping-stub-${Date.now()}` };
  }

  async updateTaskStatus(externalId: string, status: string): Promise<void> {
    // TODO: PUT ${this.config.baseUrl}/api/tasks/${externalId}/status
    logger.info({ externalId, status }, '[FlexkeepingAdapter] updateTaskStatus — stub');
  }

  async getTaskStatus(externalId: string): Promise<string> {
    // TODO: GET ${this.config.baseUrl}/api/tasks/${externalId}
    logger.info({ externalId }, '[FlexkeepingAdapter] getTaskStatus — stub');
    return 'pending';
  }

  async testConnection(): Promise<boolean> {
    // TODO: GET ${this.config.baseUrl}/api/ping
    logger.info('[FlexkeepingAdapter] testConnection — stub');
    return true;
  }
}
