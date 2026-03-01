import { prisma } from '../../config/database';
import { POSFactory } from './POSFactory';

export async function syncMenuFromPOS(
  hotelId: string,
): Promise<{ synced: number; errors: string[] }> {
  const posConfig = await prisma.hotelPOSConfig.findUnique({ where: { hotelId } });
  if (!posConfig?.syncEnabled) return { synced: 0, errors: ['POS sync disabled'] };

  const adapter = POSFactory.createAdapter({
    posType: posConfig.posType,
    apiUrl: posConfig.apiUrl,
    accessToken: posConfig.accessToken,
    spotId: posConfig.spotId,
  });
  if (!adapter) return { synced: 0, errors: ['No adapter'] };

  const errors: string[] = [];
  let synced = 0;

  try {
    const products = await adapter.getMenu();
    const categoryMap = (posConfig.categoryMap as Record<string, string>) || {};

    for (const product of products) {
      try {
        const ourCategory =
          categoryMap[product.categoryId] ||
          categoryMap[product.category] ||
          guessCategoryFromTag(product.category) ||
          'restaurant';

        await prisma.hotelService.upsert({
          where: {
            hotelId_posItemId: { hotelId, posItemId: product.posItemId },
          },
          create: {
            hotelId,
            category: ourCategory,
            name: product.name,
            description: product.description,
            price: product.price,
            currency: product.currency,
            imageUrl: product.imageUrl,
            isAvailable: product.isAvailable,
            sortOrder: product.sortOrder,
            cookingTime: product.cookingTime,
            source: 'POS_SYNC',
            posItemId: product.posItemId,
            posCategory: product.category,
            posData: {
              modifications: (product.modifications || []) as any,
              categoryId: product.categoryId,
            } as any,
            lastSyncAt: new Date(),
          },
          update: {
            name: product.name,
            price: product.price,
            imageUrl: product.imageUrl,
            isAvailable: product.isAvailable,
            cookingTime: product.cookingTime,
            posData: {
              modifications: (product.modifications || []) as any,
              categoryId: product.categoryId,
            } as any,
            lastSyncAt: new Date(),
          },
        });
        synced++;
      } catch (err: any) {
        errors.push(`Product ${product.posItemId}: ${err.message}`);
      }
    }

    // Mark products missing from POS as unavailable
    const posItemIds = products.map((p) => p.posItemId);
    if (posItemIds.length > 0) {
      await prisma.hotelService.updateMany({
        where: {
          hotelId,
          source: 'POS_SYNC',
          posItemId: { notIn: posItemIds },
        },
        data: { isAvailable: false },
      });
    }

    await prisma.hotelPOSConfig.update({
      where: { hotelId },
      data: { lastSyncAt: new Date(), lastError: null },
    });
  } catch (err: any) {
    errors.push(`Sync failed: ${err.message}`);
    await prisma.hotelPOSConfig.update({
      where: { hotelId },
      data: { lastError: err.message },
    });
  }

  return { synced, errors };
}

function guessCategoryFromTag(categoryName: string): string | null {
  const lower = categoryName.toLowerCase();
  if (lower.includes('bar') || lower.includes('бар') || lower.includes('drink')) return 'bar';
  if (lower.includes('coffee') || lower.includes('кофе')) return 'food_drink';
  if (lower.includes('dessert') || lower.includes('десерт')) return 'restaurant';
  if (lower.includes('sushi') || lower.includes('суши')) return 'restaurant';
  if (lower.includes('pizza') || lower.includes('пицца')) return 'restaurant';
  return null;
}
