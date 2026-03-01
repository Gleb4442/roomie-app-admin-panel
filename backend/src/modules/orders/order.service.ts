import { prisma } from '../../config/database';
import { POSFactory } from '../pos/POSFactory';
import { logger } from '../../shared/utils/logger';

export async function createOrder(params: {
  guestId: string;
  hotelId: string;
  type: 'FOOD' | 'HOUSEKEEPING' | 'SPA' | 'TRANSPORT';
  items: { serviceId: string; quantity: number; modifiers?: any[]; notes?: string }[];
  roomNumber?: string;
  specialInstructions?: string;
  deliveryTime?: string;
}) {
  const services = await prisma.hotelService.findMany({
    where: { id: { in: params.items.map((i) => i.serviceId) } },
  });

  let subtotal = 0;
  let maxCookingTime = 0;
  const orderItems = params.items.map((item) => {
    const service = services.find((s) => s.id === item.serviceId);
    if (!service) throw new Error(`Service ${item.serviceId} not found`);

    const modifierPrice = (item.modifiers || []).reduce(
      (sum: number, m: any) => sum + (m.price || 0),
      0,
    );
    const itemPrice = (Number(service.price || 0) + modifierPrice) * item.quantity;
    subtotal += itemPrice;

    if (service.cookingTime && service.cookingTime > maxCookingTime) {
      maxCookingTime = service.cookingTime;
    }

    return {
      serviceId: item.serviceId,
      quantity: item.quantity,
      price: Number(service.price || 0) + modifierPrice,
      modifiers: item.modifiers || [],
      notes: item.notes,
    };
  });

  // ETA: 2 min confirmation + cookingTime + 5 min delivery
  const etaSeconds = 120 + maxCookingTime + 300;
  const estimatedAt = new Date(Date.now() + etaSeconds * 1000);

  // Get room from current stay if not provided
  let roomNumber = params.roomNumber;
  if (!roomNumber) {
    const stay = await prisma.guestStay.findFirst({
      where: {
        guestId: params.guestId,
        hotelId: params.hotelId,
        stage: { in: ['IN_STAY', 'CHECKED_IN'] },
      },
    });
    roomNumber = stay?.roomNumber || undefined;
  }

  const orderNumber = 'RG-' + Math.floor(1000 + Math.random() * 9000);

  const order = await prisma.order.create({
    data: {
      orderNumber,
      guestId: params.guestId,
      hotelId: params.hotelId,
      type: params.type,
      status: 'PENDING',
      roomNumber,
      specialInstructions: params.specialInstructions,
      deliveryTime: params.deliveryTime,
      subtotal,
      currency: services[0]?.currency || 'EUR',
      maxCookingTime: maxCookingTime || null,
      estimatedAt,
      items: { create: orderItems },
    },
    include: { items: { include: { service: true } } },
  });

  await sendOrderToPOS(order);

  return order;
}

async function sendOrderToPOS(order: any) {
  const posConfig = await prisma.hotelPOSConfig.findUnique({
    where: { hotelId: order.hotelId },
  });
  if (!posConfig?.syncEnabled) return;

  const adapter = POSFactory.createAdapter({
    posType: posConfig.posType,
    apiUrl: posConfig.apiUrl,
    accessToken: posConfig.accessToken,
    spotId: posConfig.spotId,
  });
  if (!adapter) return;

  try {
    const posItems = order.items
      .filter((item: any) => item.service.posItemId)
      .map((item: any) => ({
        posItemId: item.service.posItemId,
        qty: item.quantity,
        modifications: item.modifiers
          ?.filter((m: any) => m.posterId)
          .map((m: any) => ({ m: m.posterId, a: 1 })),
      }));

    if (posItems.length === 0) return;

    const comment = [
      `Room ${order.roomNumber || '?'}`,
      `Order ${order.orderNumber}`,
      order.specialInstructions,
    ]
      .filter(Boolean)
      .join(' | ');

    const result = await adapter.createOrder({
      items: posItems,
      spotId: posConfig.spotId || '1',
      comment,
      serviceMode: 3,
    });

    await prisma.order.update({
      where: { id: order.id },
      data: {
        posOrderId: result.posOrderId,
        posStatus: String(result.status),
        status: 'SENT_TO_POS',
      },
    });
  } catch (err: any) {
    logger.error(`[POS] Failed to send order ${order.id}: ${err.message}`);
  }
}

export async function getGuestOrders(guestId: string, hotelId?: string) {
  return prisma.order.findMany({
    where: {
      guestId,
      ...(hotelId ? { hotelId } : {}),
    },
    include: { items: { include: { service: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getOrderById(orderId: string, guestId: string) {
  return prisma.order.findFirst({
    where: { id: orderId, guestId },
    include: { items: { include: { service: true } } },
  });
}

export async function getOrderTracking(orderId: string, guestId: string) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, guestId },
    include: { items: { include: { service: true } } },
  });
  if (!order) return null;

  const timeline = buildTimeline(order);
  return { ...order, ...timeline };
}

function buildTimeline(order: any) {
  const steps = [
    {
      step: 'received',
      label: 'Order Received',
      time: order.createdAt,
      completed: true,
      active: ['PENDING', 'SENT_TO_POS'].includes(order.status),
    },
    {
      step: 'confirmed',
      label: 'Confirmed',
      time: order.confirmedAt,
      completed: ['CONFIRMED', 'PREPARING', 'READY', 'IN_TRANSIT', 'DELIVERED', 'COMPLETED'].includes(order.status),
      active: order.status === 'CONFIRMED',
    },
    {
      step: 'preparing',
      label: 'Preparing',
      time: order.preparingAt,
      completed: ['PREPARING', 'READY', 'IN_TRANSIT', 'DELIVERED', 'COMPLETED'].includes(order.status),
      active: order.status === 'PREPARING',
      description: order.status === 'PREPARING' ? 'Our chefs are crafting your meal with care.' : null,
    },
    {
      step: 'in_transit',
      label: 'In Transit',
      time: order.inTransitAt,
      completed: ['IN_TRANSIT', 'DELIVERED', 'COMPLETED'].includes(order.status),
      active: order.status === 'IN_TRANSIT',
    },
    {
      step: 'delivered',
      label: 'Delivered',
      time: order.deliveredAt,
      completed: ['DELIVERED', 'COMPLETED'].includes(order.status),
      active: false,
    },
  ];

  const estimatedMinutes = order.estimatedAt
    ? Math.max(0, Math.round((order.estimatedAt.getTime() - Date.now()) / 60000))
    : null;

  return { steps, estimatedMinutes };
}

export async function cancelOrder(orderId: string, guestId: string) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, guestId },
  });
  if (!order) throw new Error('Order not found');

  if (!['PENDING', 'CONFIRMED', 'SENT_TO_POS'].includes(order.status)) {
    throw new Error('Cannot cancel order in current status');
  }

  return prisma.order.update({
    where: { id: order.id },
    data: { status: 'CANCELLED', cancelledAt: new Date() },
  });
}

// ─── Auto-Timer ──────────────────────────────────

export async function processAutoTimerStatuses() {
  const now = new Date();

  // CONFIRMED → PREPARING (2 min after confirmedAt)
  const toPrep = await prisma.order.findMany({
    where: {
      status: 'CONFIRMED',
      confirmedAt: { lte: new Date(now.getTime() - 2 * 60 * 1000) },
    },
  });
  for (const order of toPrep) {
    await prisma.order.update({
      where: { id: order.id },
      data: { status: 'PREPARING', preparingAt: now },
    });
  }

  // PREPARING → IN_TRANSIT (after cookingTime)
  const toTransit = await prisma.order.findMany({
    where: {
      status: 'PREPARING',
      preparingAt: { not: null },
    },
  });
  for (const order of toTransit) {
    const cookingMs = (order.maxCookingTime || 600) * 1000;
    const readyTime = new Date(order.preparingAt!.getTime() + cookingMs);
    if (now >= readyTime) {
      await prisma.order.update({
        where: { id: order.id },
        data: {
          status: 'IN_TRANSIT',
          readyAt: readyTime,
          inTransitAt: now,
        },
      });
    }
  }

  // PENDING without POS → auto-CONFIRMED after 1 min
  const pendingNoPOS = await prisma.order.findMany({
    where: {
      status: 'PENDING',
      posOrderId: null,
      createdAt: { lte: new Date(now.getTime() - 1 * 60 * 1000) },
    },
  });
  for (const order of pendingNoPOS) {
    await prisma.order.update({
      where: { id: order.id },
      data: { status: 'CONFIRMED', confirmedAt: now },
    });
  }

  // IN_TRANSIT without webhook → auto-DELIVERED after 10 min
  const toDeliver = await prisma.order.findMany({
    where: {
      status: 'IN_TRANSIT',
      inTransitAt: { lte: new Date(now.getTime() - 10 * 60 * 1000) },
      posTransactionId: null,
    },
  });
  for (const order of toDeliver) {
    await prisma.order.update({
      where: { id: order.id },
      data: { status: 'DELIVERED', deliveredAt: now },
    });
  }
}
