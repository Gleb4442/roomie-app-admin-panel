import { prisma } from '../../config/database';
import { JourneyStage } from '@prisma/client';
import { AppError } from '../../shared/middleware/errorHandler';

export const journeyService = {
  async getCurrentStay(guestId: string, hotelId?: string) {
    const where: Record<string, unknown> = { guestId };
    if (hotelId) where.hotelId = hotelId;

    // 1. Active stay (IN_STAY or CHECKED_IN)
    const activeStay = await prisma.guestStay.findFirst({
      where: { ...where, stage: { in: ['IN_STAY', 'CHECKED_IN'] } },
      include: { hotel: true },
      orderBy: { updatedAt: 'desc' },
    });
    if (activeStay) {
      return { stage: activeStay.stage, stay: activeStay, hotel: activeStay.hotel };
    }

    // 2. Upcoming stay (PRE_ARRIVAL with future checkIn)
    const upcomingStay = await prisma.guestStay.findFirst({
      where: {
        ...where,
        stage: 'PRE_ARRIVAL',
        OR: [
          { checkIn: { gte: new Date() } },
          { checkIn: null },
        ],
      },
      include: { hotel: true },
      orderBy: { checkIn: 'asc' },
    });
    if (upcomingStay) {
      return { stage: 'PRE_ARRIVAL' as JourneyStage, stay: upcomingStay, hotel: upcomingStay.hotel };
    }

    // 3. Recent POST_STAY (within 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentStay = await prisma.guestStay.findFirst({
      where: {
        ...where,
        stage: 'POST_STAY',
        checkOut: { gte: sevenDaysAgo },
      },
      include: { hotel: true },
      orderBy: { checkOut: 'desc' },
    });
    if (recentStay) {
      return { stage: 'POST_STAY' as JourneyStage, stay: recentStay, hotel: recentStay.hotel };
    }

    // 4. If hotelId specified, try to get hotel info
    if (hotelId) {
      const hotel = await prisma.hotel.findUnique({ where: { id: hotelId } });
      return { stage: 'BETWEEN_STAYS' as JourneyStage, stay: null, hotel };
    }

    // 5. Check if guest has any linked hotel
    const lastLink = await prisma.guestHotel.findFirst({
      where: { guestId },
      include: { hotel: true },
      orderBy: { linkedAt: 'desc' },
    });

    return {
      stage: 'BETWEEN_STAYS' as JourneyStage,
      stay: null,
      hotel: lastLink?.hotel || null,
    };
  },

  async updateStage(stayId: string, guestId: string, stage: JourneyStage, roomNumber?: string) {
    const stay = await prisma.guestStay.findFirst({
      where: { id: stayId, guestId },
    });

    if (!stay) {
      throw new AppError(404, 'Stay not found');
    }

    const updated = await prisma.guestStay.update({
      where: { id: stayId },
      data: {
        stage,
        ...(roomNumber ? { roomNumber } : {}),
      },
      include: { hotel: true },
    });

    return updated;
  },
};
