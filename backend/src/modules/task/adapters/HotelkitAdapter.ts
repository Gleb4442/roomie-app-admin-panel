import { BaseTMSAdapter, TMSCapabilities, TMSStatusMapping } from './BaseTMSAdapter';
import { TMSTask } from '../types';
import { logger } from '../../../shared/utils/logger';

export class HotelkitAdapter extends BaseTMSAdapter {
  readonly name = 'hotelkit';
  readonly capabilities: TMSCapabilities = {
    supportsStatusSync: true,
    supportsWebhook: true,
    supportsPriorityMapping: true,
    supportsDepartmentMapping: true,
    supportsAssigneeSync: true,
  };

  constructor(private config: { apiKey: string; baseUrl: string }) {
    super();
  }

  getStatusMapping(): TMSStatusMapping {
    return {
      toExternal: {
        NEW: 'open', ASSIGNED: 'assigned', ACCEPTED: 'accepted',
        IN_PROGRESS: 'in_progress', COMPLETED: 'done', CANCELLED: 'cancelled',
      },
      toInternal: {
        open: 'NEW', assigned: 'ASSIGNED', accepted: 'ACCEPTED',
        in_progress: 'IN_PROGRESS', done: 'COMPLETED', cancelled: 'CANCELLED',
      },
    };
  }

  async createTask(task: TMSTask): Promise<{ externalId: string }> {
    // TODO: implement real Hotelkit API call
    logger.info({ task: task.title }, '[HotelkitAdapter] createTask — stub');
    return { externalId: `hotelkit-stub-${Date.now()}` };
  }

  async updateTaskStatus(externalId: string, status: string): Promise<void> {
    const mapped = this.getStatusMapping().toExternal[status] || status;
    logger.info({ externalId, status: mapped }, '[HotelkitAdapter] updateTaskStatus — stub');
  }

  async getTaskStatus(externalId: string): Promise<string> {
    logger.info({ externalId }, '[HotelkitAdapter] getTaskStatus — stub');
    return 'pending';
  }

  async testConnection(): Promise<boolean> {
    logger.info('[HotelkitAdapter] testConnection — stub');
    return true;
  }

  parseWebhook(payload: any): { externalId: string; status: string } | null {
    if (payload?.event === 'task.updated' && payload?.task?.id) {
      const internalStatus = this.getStatusMapping().toInternal[payload.task.status] || payload.task.status;
      return { externalId: payload.task.id, status: internalStatus };
    }
    return null;
  }
}
