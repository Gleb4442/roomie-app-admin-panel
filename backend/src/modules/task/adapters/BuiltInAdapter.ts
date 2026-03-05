/**
 * BuiltInAdapter — for hotels that use HotelMol as their only TMS.
 * All operations are no-ops since tasks are already in our DB.
 */

import { BaseTMSAdapter, TMSCapabilities } from './BaseTMSAdapter';
import { TMSTask } from '../types';

export class BuiltInAdapter extends BaseTMSAdapter {
  readonly name = 'built_in';
  readonly capabilities: TMSCapabilities = {
    supportsStatusSync: false,
    supportsWebhook: false,
    supportsPriorityMapping: false,
    supportsDepartmentMapping: false,
    supportsAssigneeSync: false,
  };

  async createTask(_task: TMSTask): Promise<{ externalId: string }> {
    return { externalId: '' };
  }

  async updateTaskStatus(_externalId: string, _status: string): Promise<void> {}

  async getTaskStatus(_externalId: string): Promise<string> {
    return 'synced';
  }

  async testConnection(): Promise<boolean> {
    return true;
  }
}
