import { BaseTMSAdapter, TMSCapabilities, TMSStatusMapping } from './BaseTMSAdapter';
import { TMSTask } from '../types';
import { logger } from '../../../shared/utils/logger';

export class FlexkeepingAdapter extends BaseTMSAdapter {
  readonly name = 'flexkeeping';
  readonly capabilities: TMSCapabilities = {
    supportsStatusSync: true,
    supportsWebhook: true,
    supportsPriorityMapping: true,
    supportsDepartmentMapping: false,
    supportsAssigneeSync: false,
    missingStatuses: ['ACCEPTED', 'ON_HOLD'], // Flexkeeping doesn't have these
  };

  constructor(private config: { apiKey: string; baseUrl: string }) {
    super();
  }

  getStatusMapping(): TMSStatusMapping {
    return {
      toExternal: {
        NEW: 'new', ASSIGNED: 'assigned', ACCEPTED: 'assigned', // gap-fill: ACCEPTED → assigned
        IN_PROGRESS: 'in_progress', ON_HOLD: 'in_progress', // gap-fill: ON_HOLD → in_progress
        COMPLETED: 'completed', CANCELLED: 'cancelled',
      },
      toInternal: {
        new: 'NEW', assigned: 'ASSIGNED',
        in_progress: 'IN_PROGRESS', completed: 'COMPLETED', cancelled: 'CANCELLED',
      },
    };
  }

  async createTask(task: TMSTask): Promise<{ externalId: string }> {
    // TODO: implement real Flexkeeping API call
    logger.info({ task: task.title }, '[FlexkeepingAdapter] createTask — stub');
    return { externalId: `flexkeeping-stub-${Date.now()}` };
  }

  async updateTaskStatus(externalId: string, status: string): Promise<void> {
    const mapped = this.getStatusMapping().toExternal[status] || status;
    logger.info({ externalId, status: mapped }, '[FlexkeepingAdapter] updateTaskStatus — stub');
  }

  async getTaskStatus(externalId: string): Promise<string> {
    logger.info({ externalId }, '[FlexkeepingAdapter] getTaskStatus — stub');
    return 'new';
  }

  async testConnection(): Promise<boolean> {
    logger.info('[FlexkeepingAdapter] testConnection — stub');
    return true;
  }

  parseWebhook(payload: any): { externalId: string; status: string } | null {
    if (payload?.task_id && payload?.status) {
      const internalStatus = this.getStatusMapping().toInternal[payload.status] || payload.status;
      return { externalId: payload.task_id, status: internalStatus };
    }
    return null;
  }
}
