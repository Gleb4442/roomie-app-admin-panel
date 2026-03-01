import { prisma } from '../../config/database';
import { TMSFactory } from './tmsFactory';
import { TMSTask } from './types';
import { logger } from '../../shared/utils/logger';

export const tmsConnector = {
  async pushTask(serviceRequest: {
    id: string;
    hotelId: string;
    roomNumber?: string | null;
    comment?: string | null;
    requestedTime?: Date | null;
    category: { name: string; slug: string };
    guest: { firstName: string; lastName?: string | null };
    items: Array<{
      quantity: number;
      serviceItem: { name: string };
    }>;
  }): Promise<void> {
    const tmsConfig = await prisma.hotelTMSConfig.findUnique({
      where: { hotelId: serviceRequest.hotelId },
    });

    if (!tmsConfig || !tmsConfig.enabled || tmsConfig.provider === 'none') {
      return;
    }

    try {
      const mapping = tmsConfig.categoryMapping as Record<string, string>;
      const externalCategoryId = mapping[serviceRequest.category.slug] || '';

      const adapter = TMSFactory.createAdapter(tmsConfig);

      const task: TMSTask = {
        title: `${serviceRequest.category.name} — Room ${serviceRequest.roomNumber || 'N/A'}`,
        description: serviceRequest.comment || '',
        categoryId: externalCategoryId,
        roomNumber: serviceRequest.roomNumber || undefined,
        priority: 'medium',
        guestName: `${serviceRequest.guest.firstName} ${serviceRequest.guest.lastName || ''}`.trim(),
        items: serviceRequest.items.map((i) => ({
          name: i.serviceItem.name,
          quantity: i.quantity,
        })),
        requestedTime: serviceRequest.requestedTime || undefined,
      };

      const result = await adapter.createTask(task);

      await prisma.serviceRequest.update({
        where: { id: serviceRequest.id },
        data: {
          externalTaskId: result.externalId,
          externalSystem: tmsConfig.provider,
        },
      });

      logger.info(
        { requestId: serviceRequest.id, externalId: result.externalId },
        'Task pushed to external TMS',
      );
    } catch (err) {
      logger.error(err, 'Failed to push task to external TMS');
    }
  },

  async syncStatus(serviceRequestId: string): Promise<void> {
    const request = await prisma.serviceRequest.findUnique({
      where: { id: serviceRequestId },
    });

    if (!request?.externalTaskId || !request.externalSystem) return;

    const tmsConfig = await prisma.hotelTMSConfig.findUnique({
      where: { hotelId: request.hotelId },
    });

    if (!tmsConfig || !tmsConfig.enabled) return;

    try {
      const adapter = TMSFactory.createAdapter(tmsConfig);
      const externalStatus = await adapter.getTaskStatus(request.externalTaskId);
      logger.info(
        { requestId: serviceRequestId, externalStatus },
        'Synced TMS status',
      );
    } catch (err) {
      logger.error(err, 'Failed to sync TMS status');
    }
  },

  async testConnection(hotelId: string): Promise<{ success: boolean; error?: string }> {
    const tmsConfig = await prisma.hotelTMSConfig.findUnique({
      where: { hotelId },
    });

    if (!tmsConfig) {
      return { success: false, error: 'TMS not configured' };
    }

    try {
      const adapter = TMSFactory.createAdapter(tmsConfig);
      const ok = await adapter.testConnection();
      return { success: ok };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Connection failed';
      return { success: false, error: message };
    }
  },
};
