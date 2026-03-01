import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { EntrySource } from '@prisma/client';

export const trackingService = {
  async trackAppOpen(data: {
    source: EntrySource;
    hotelId?: string;
    contextParams?: Record<string, unknown>;
    deviceInfo?: Record<string, unknown>;
  }) {
    const appOpen = await prisma.appOpen.create({
      data: {
        source: data.source,
        hotelId: data.hotelId ?? undefined,
        contextParams: (data.contextParams as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        deviceInfo: (data.deviceInfo as Prisma.InputJsonValue) ?? Prisma.JsonNull,
      },
    });

    return { tracked: true, id: appOpen.id };
  },
};
