import { prisma } from '../../config/database';
import { logger } from '../../shared/utils/logger';

interface DefaultCategoryItem {
  name: string;
  nameUk: string;
  nameEn: string;
  price: number;
  maxQuantity?: number;
}

interface DefaultCategory {
  name: string;
  nameUk: string;
  nameEn: string;
  slug: string;
  icon: string;
  description: string;
  descriptionUk: string;
  descriptionEn: string;
  requiresRoom: boolean;
  requiresTimeSlot: boolean;
  autoAccept: boolean;
  estimatedMinutes: number | null;
  items: DefaultCategoryItem[];
}

const DEFAULT_CATEGORIES: DefaultCategory[] = [
  {
    name: 'Уборка номера',
    nameUk: 'Прибирання номера',
    nameEn: 'Room Cleaning',
    slug: 'cleaning',
    icon: 'sparkles',
    description: 'Запросите уборку вашего номера',
    descriptionUk: 'Замовте прибирання вашого номера',
    descriptionEn: 'Request cleaning for your room',
    requiresRoom: true,
    requiresTimeSlot: false,
    autoAccept: true,
    estimatedMinutes: 30,
    items: [
      { name: 'Стандартная уборка', nameUk: 'Стандартне прибирання', nameEn: 'Standard cleaning', price: 0 },
      { name: 'Генеральная уборка', nameUk: 'Генеральне прибирання', nameEn: 'Deep cleaning', price: 0 },
    ],
  },
  {
    name: 'Полотенца и принадлежности',
    nameUk: 'Рушники та приладдя',
    nameEn: 'Towels & Amenities',
    slug: 'amenities',
    icon: 'bath',
    description: 'Дополнительные полотенца, мыло, шампунь',
    descriptionUk: 'Додаткові рушники, мило, шампунь',
    descriptionEn: 'Extra towels, soap, shampoo',
    requiresRoom: true,
    requiresTimeSlot: false,
    autoAccept: true,
    estimatedMinutes: 15,
    items: [
      { name: 'Полотенце банное', nameUk: 'Рушник банний', nameEn: 'Bath towel', price: 0, maxQuantity: 5 },
      { name: 'Полотенце для рук', nameUk: 'Рушник для рук', nameEn: 'Hand towel', price: 0, maxQuantity: 5 },
      { name: 'Набор мыло + шампунь', nameUk: 'Набір мило + шампунь', nameEn: 'Soap + shampoo set', price: 0, maxQuantity: 3 },
      { name: 'Халат', nameUk: 'Халат', nameEn: 'Bathrobe', price: 0, maxQuantity: 2 },
      { name: 'Тапочки', nameUk: 'Капці', nameEn: 'Slippers', price: 0, maxQuantity: 2 },
    ],
  },
  {
    name: 'Мини-бар',
    nameUk: 'Міні-бар',
    nameEn: 'Mini-bar',
    slug: 'minibar',
    icon: 'wine',
    description: 'Пополнение мини-бара в номере',
    descriptionUk: 'Поповнення міні-бару в номері',
    descriptionEn: 'Restock your room mini-bar',
    requiresRoom: true,
    requiresTimeSlot: false,
    autoAccept: true,
    estimatedMinutes: 20,
    items: [
      { name: 'Вода 0.5л', nameUk: 'Вода 0.5л', nameEn: 'Water 0.5L', price: 30, maxQuantity: 5 },
      { name: 'Coca-Cola', nameUk: 'Coca-Cola', nameEn: 'Coca-Cola', price: 45, maxQuantity: 3 },
      { name: 'Сок апельсиновый', nameUk: 'Сік апельсиновий', nameEn: 'Orange juice', price: 55, maxQuantity: 3 },
      { name: 'Пиво', nameUk: 'Пиво', nameEn: 'Beer', price: 65, maxQuantity: 3 },
      { name: 'Вино (мини)', nameUk: 'Вино (міні)', nameEn: 'Wine (mini)', price: 120, maxQuantity: 2 },
      { name: 'Снеки', nameUk: 'Снеки', nameEn: 'Snacks', price: 40, maxQuantity: 5 },
    ],
  },
  {
    name: 'Час виїзду / заїзду',
    nameUk: 'Час виїзду / заїзду',
    nameEn: 'Check-out / Check-in time',
    slug: 'checkout',
    icon: 'clock',
    description: 'Запросите поздний выезд или ранний заезд',
    descriptionUk: 'Запросіть пізній виїзд або ранній заїзд',
    descriptionEn: 'Request late check-out or early check-in',
    requiresRoom: true,
    requiresTimeSlot: true,
    autoAccept: false,
    estimatedMinutes: null,
    items: [
      { name: 'Поздний выезд до 14:00', nameUk: 'Пізній виїзд до 14:00', nameEn: 'Late checkout until 2 PM', price: 0 },
      { name: 'Поздний выезд до 18:00', nameUk: 'Пізній виїзд до 18:00', nameEn: 'Late checkout until 6 PM', price: 500 },
      { name: 'Ранний заезд с 10:00', nameUk: 'Ранній заїзд з 10:00', nameEn: 'Early check-in from 10 AM', price: 0 },
    ],
  },
];

export async function seedDefaultCategories(hotelId: string): Promise<number> {
  let created = 0;

  for (let i = 0; i < DEFAULT_CATEGORIES.length; i++) {
    const cat = DEFAULT_CATEGORIES[i];

    // Skip if already exists
    const existing = await prisma.serviceCategory.findUnique({
      where: { hotelId_slug: { hotelId, slug: cat.slug } },
    });
    if (existing) continue;

    await prisma.serviceCategory.create({
      data: {
        hotelId,
        name: cat.name,
        nameUk: cat.nameUk,
        nameEn: cat.nameEn,
        slug: cat.slug,
        icon: cat.icon,
        description: cat.description,
        descriptionUk: cat.descriptionUk,
        descriptionEn: cat.descriptionEn,
        sortOrder: i,
        requiresRoom: cat.requiresRoom,
        requiresTimeSlot: cat.requiresTimeSlot,
        autoAccept: cat.autoAccept,
        estimatedMinutes: cat.estimatedMinutes,
        items: {
          create: cat.items.map((item, idx) => ({
            name: item.name,
            nameUk: item.nameUk,
            nameEn: item.nameEn,
            price: item.price,
            maxQuantity: item.maxQuantity ?? 10,
            sortOrder: idx,
          })),
        },
      },
    });

    created++;
  }

  logger.info({ hotelId, created }, 'Seeded default service categories');
  return created;
}
