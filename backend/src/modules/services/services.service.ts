import { prisma } from '../../config/database';

export async function getHotelServices(hotelId: string, category?: string) {
  const where: any = {
    hotelId,
    isAvailable: true,
  };
  if (category) where.category = category;

  const services = await prisma.hotelService.findMany({
    where,
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });

  // Group by category
  const grouped: Record<string, typeof services> = {};
  for (const s of services) {
    if (!grouped[s.category]) grouped[s.category] = [];
    grouped[s.category].push(s);
  }

  return { services, grouped };
}

export async function getServiceById(serviceId: string) {
  return prisma.hotelService.findUnique({
    where: { id: serviceId },
  });
}
