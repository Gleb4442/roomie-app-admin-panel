/**
 * GenericWebhookAdapter — sends tasks to an external system via outgoing webhooks.
 * Receives updates via incoming webhooks.
 */

import { BaseTMSAdapter, TMSCapabilities } from './BaseTMSAdapter';
import { TMSTask } from '../types';
import { logger } from '../../../shared/utils/logger';

export class GenericWebhookAdapter extends BaseTMSAdapter {
  readonly name = 'generic_webhook';
  readonly capabilities: TMSCapabilities = {
    supportsStatusSync: true,
    supportsWebhook: true,
    supportsPriorityMapping: false,
    supportsDepartmentMapping: false,
    supportsAssigneeSync: false,
  };

  constructor(private config: { webhookUrl: string; webhookSecret?: string }) {
    super();
  }

  async createTask(task: TMSTask): Promise<{ externalId: string }> {
    try {
      const response = await fetch(this.config.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.webhookSecret ? { 'X-Webhook-Secret': this.config.webhookSecret } : {}),
        },
        body: JSON.stringify({ event: 'task.created', task }),
      });

      const data = await response.json() as any;
      return { externalId: data?.externalId || `webhook-${Date.now()}` };
    } catch (err) {
      logger.error(err, '[GenericWebhookAdapter] createTask failed');
      return { externalId: `webhook-failed-${Date.now()}` };
    }
  }

  async updateTaskStatus(externalId: string, status: string): Promise<void> {
    try {
      await fetch(this.config.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.webhookSecret ? { 'X-Webhook-Secret': this.config.webhookSecret } : {}),
        },
        body: JSON.stringify({ event: 'task.status_updated', externalId, status }),
      });
    } catch (err) {
      logger.error(err, '[GenericWebhookAdapter] updateTaskStatus failed');
    }
  }

  async getTaskStatus(_externalId: string): Promise<string> {
    return 'unknown';
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(this.config.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'ping' }),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  parseWebhook(payload: any): { externalId: string; status: string } | null {
    if (payload?.externalId && payload?.status) {
      return { externalId: payload.externalId, status: payload.status };
    }
    return null;
  }
}
