import { prisma } from '../../config/database';
import { AppError } from '../../shared/middleware/errorHandler';

export const hotelService = {
  async getById(hotelId: string) {
    const hotel = await prisma.hotel.findUnique({
      where: { id: hotelId },
      select: {
        id: true,
        name: true,
        slug: true,
        location: true,
        description: true,
        accentColor: true,
        imageUrl: true,
        contactEmail: true,
        contactPhone: true,
        timezone: true,
        settings: true,
      },
    });

    if (!hotel) {
      throw new AppError(404, 'Hotel not found');
    }

    return hotel;
  },
};
