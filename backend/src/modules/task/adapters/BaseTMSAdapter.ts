import { TMSTask } from '../types';

export abstract class BaseTMSAdapter {
  abstract createTask(task: TMSTask): Promise<{ externalId: string }>;
  abstract updateTaskStatus(externalId: string, status: string): Promise<void>;
  abstract getTaskStatus(externalId: string): Promise<string>;
  abstract testConnection(): Promise<boolean>;
}
