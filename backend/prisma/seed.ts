import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  const hotel1 = await prisma.hotel.upsert({
    where: { slug: 'grand-hyatt-kyiv' },
    update: {},
    create: {
      name: 'Grand Hyatt Kyiv',
      slug: 'grand-hyatt-kyiv',
      location: 'Kyiv, Ukraine',
      description: 'A luxurious 5-star hotel in the heart of Kyiv with stunning views of the Dnipro river.',
      accentColor: '#1152d4',
      imageUrl: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80',
      contactEmail: 'info@grandhyattkyiv.com',
      contactPhone: '+380 44 123 4567',
      timezone: 'Europe/Kyiv',
      settings: {
        preCheckInEnabled: true,
        smsEnabled: true,
        chatEnabled: true,
      },
    },
  });

  const hotel2 = await prisma.hotel.upsert({
    where: { slug: 'alpine-resort-innsbruck' },
    update: {},
    create: {
      name: 'Alpine Resort & Spa',
      slug: 'alpine-resort-innsbruck',
      location: 'Innsbruck, Austria',
      description: 'Nestled in the Austrian Alps, a perfect getaway with world-class spa and ski access.',
      accentColor: '#0d9488',
      imageUrl: 'https://images.unsplash.com/photo-1582719508461-905c673771fd?w=800&q=80',
      contactEmail: 'reservations@alpineresort.at',
      contactPhone: '+43 512 987 654',
      timezone: 'Europe/Vienna',
      settings: {
        preCheckInEnabled: true,
        smsEnabled: false,
        chatEnabled: true,
      },
    },
  });

  const hotel3 = await prisma.hotel.upsert({
    where: { slug: 'seaside-boutique-odesa' },
    update: {},
    create: {
      name: 'Seaside Boutique Hotel',
      slug: 'seaside-boutique-odesa',
      location: 'Odesa, Ukraine',
      description: 'A charming boutique hotel on the Black Sea coast with panoramic sea views.',
      accentColor: '#4f46e5',
      imageUrl: 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800&q=80',
      contactEmail: 'hello@seasideboutique.ua',
      contactPhone: '+380 48 765 4321',
      timezone: 'Europe/Kyiv',
      settings: {
        preCheckInEnabled: false,
        smsEnabled: true,
        chatEnabled: true,
      },
    },
  });

  console.log('Seeded hotels:', hotel1.name, hotel2.name, hotel3.name);

  // ──── Seed Services for hotel1 ─────────────────

  const services = [
    // Restaurant
    { hotelId: hotel1.id, category: 'restaurant', name: 'Truffle Wagyu Burger', description: 'Premium wagyu beef with black truffle aioli and aged cheddar', price: 24, cookingTime: 900, sortOrder: 1, imageUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&q=80' },
    { hotelId: hotel1.id, category: 'restaurant', name: 'Caesar Salad', description: 'Crisp romaine, parmesan, croutons, classic Caesar dressing', price: 14, cookingTime: 600, sortOrder: 2, imageUrl: 'https://images.unsplash.com/photo-1546793665-c74683f339c1?w=400&q=80' },
    { hotelId: hotel1.id, category: 'restaurant', name: 'Grilled Salmon', description: 'Atlantic salmon with lemon butter sauce and seasonal vegetables', price: 28, cookingTime: 1200, sortOrder: 3, imageUrl: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=400&q=80' },
    // Bar
    { hotelId: hotel1.id, category: 'bar', name: 'Fresh Orange Juice', description: 'Freshly squeezed premium oranges', price: 6, cookingTime: 120, sortOrder: 1, imageUrl: 'https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=400&q=80' },
    { hotelId: hotel1.id, category: 'bar', name: 'Espresso', description: 'Double shot Italian espresso', price: 4, cookingTime: 180, sortOrder: 2, imageUrl: 'https://images.unsplash.com/photo-1510707577719-ae7c14805e3a?w=400&q=80' },
    // Housekeeping
    { hotelId: hotel1.id, category: 'housekeeping', name: 'Extra Towels', description: 'Fresh set of bath and hand towels', price: 0, cookingTime: null, sortOrder: 1 },
    { hotelId: hotel1.id, category: 'housekeeping', name: 'Room Cleaning', description: 'Full room cleaning service', price: 0, cookingTime: null, sortOrder: 2 },
    // Spa
    { hotelId: hotel1.id, category: 'spa', name: 'Swedish Massage 60min', description: 'Full body relaxation massage', price: 80, cookingTime: null, sortOrder: 1 },
    { hotelId: hotel1.id, category: 'spa', name: 'Facial Treatment', description: 'Deep cleansing facial with premium products', price: 60, cookingTime: null, sortOrder: 2 },
    // Transport
    { hotelId: hotel1.id, category: 'transport', name: 'Airport Transfer', description: 'Private car to/from Boryspil International Airport', price: 35, cookingTime: null, sortOrder: 1 },
  ];

  for (const svc of services) {
    await prisma.hotelService.upsert({
      where: {
        hotelId_posItemId: { hotelId: svc.hotelId, posItemId: `manual-${svc.name.toLowerCase().replace(/\s+/g, '-')}` },
      },
      update: {
        name: svc.name,
        description: svc.description,
        price: svc.price,
        cookingTime: svc.cookingTime,
      },
      create: {
        hotelId: svc.hotelId,
        category: svc.category,
        name: svc.name,
        description: svc.description,
        price: svc.price,
        currency: 'EUR',
        cookingTime: svc.cookingTime,
        sortOrder: svc.sortOrder,
        source: 'MANUAL',
        posItemId: `manual-${svc.name.toLowerCase().replace(/\s+/g, '-')}`,
        imageUrl: (svc as any).imageUrl || null,
      },
    });
  }

  console.log(`Seeded ${services.length} services for ${hotel1.name}`);

  // ──── Seed POS Config ──────────────────────────

  await prisma.hotelPOSConfig.upsert({
    where: { hotelId: hotel1.id },
    update: {},
    create: {
      hotelId: hotel1.id,
      posType: 'poster',
      apiUrl: 'https://joinposter.com/api',
      accessToken: 'placeholder-token',
      spotId: '1',
      syncEnabled: false,
    },
  });

  console.log('Seeded POS config for', hotel1.name);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
