import { TMSTask } from '../types';

export interface TMSCapabilities {
  supportsStatusSync: boolean;
  supportsWebhook: boolean;
  supportsPriorityMapping: boolean;
  supportsDepartmentMapping: boolean;
  supportsAssigneeSync: boolean;
  missingStatuses?: string[];
}

export interface TMSStatusMapping {
  toExternal: Record<string, string>;
  toInternal: Record<string, string>;
}

export abstract class BaseTMSAdapter {
  abstract readonly name: string;
  abstract readonly capabilities: TMSCapabilities;

  abstract createTask(task: TMSTask): Promise<{ externalId: string }>;
  abstract updateTaskStatus(externalId: string, status: string): Promise<void>;
  abstract getTaskStatus(externalId: string): Promise<string>;
  abstract testConnection(): Promise<boolean>;

  async deleteTask(_externalId: string): Promise<void> {}
  async syncAssignee(_externalId: string, _staffName: string): Promise<void> {}

  getStatusMapping(): TMSStatusMapping {
    return { toExternal: {}, toInternal: {} };
  }

  async healthCheck(): Promise<{ healthy: boolean; latencyMs: number; error?: string }> {
    const start = Date.now();
    try {
      const ok = await this.testConnection();
      return { healthy: ok, latencyMs: Date.now() - start };
    } catch (err: unknown) {
      return { healthy: false, latencyMs: Date.now() - start, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }

  parseWebhook(_payload: any, _signature?: string): { externalId: string; status: string; data?: any } | null {
    return null;
  }
}
