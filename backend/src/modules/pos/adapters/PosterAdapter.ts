import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';
import { POSAdapter, POSMenuItem, POSModificationGroup, POSOrderResult } from '../POSAdapter';

export class PosterAdapter implements POSAdapter {
  private client: AxiosInstance;
  private token: string;

  constructor(private config: { apiUrl: string; accessToken: string; spotId?: string }) {
    this.token = config.accessToken;
    this.client = axios.create({
      baseURL: config.apiUrl || 'https://joinposter.com/api',
      timeout: 15000,
    });
  }

  async getCategories() {
    const { data } = await this.client.get('/menu.getCategories', {
      params: { token: this.token },
    });

    if (!data.response) throw new Error('Poster: getCategories failed');

    return data.response
      .filter((c: any) => c.category_hidden === '0')
      .map((c: any) => ({
        id: c.category_id,
        name: c.category_name,
        photo: c.category_photo || null,
        sortOrder: parseInt(c.sort_order) || 999,
      }));
  }

  async getMenu(): Promise<POSMenuItem[]> {
    const { data } = await this.client.get('/menu.getProducts', {
      params: { token: this.token },
    });

    if (!data.response) throw new Error('Poster: getProducts failed');

    return data.response
      .filter((p: any) => p.hidden === '0')
      .map((p: any) => {
        const spot =
          p.spots?.find((s: any) => String(s.spot_id) === String(this.config.spotId)) ||
          p.spots?.[0];

        const priceKopecks = parseInt(spot?.price || '0');
        const price = priceKopecks / 100;

        const modifications: POSModificationGroup[] = (p.group_modifications || [])
          .filter((g: any) => g.is_deleted !== '1')
          .map((g: any) => ({
            groupId: g.dish_modification_group_id,
            name: g.name,
            minQty: parseInt(g.num_min) || 0,
            maxQty: parseInt(g.num_max) || 1,
            options: (g.modifications || []).map((m: any) => ({
              id: m.dish_modification_id,
              name: m.name,
              price: parseInt(m.price || '0') / 100,
            })),
          }));

        let imageUrl = p.photo_origin || p.photo || null;
        if (imageUrl && !imageUrl.startsWith('http')) {
          imageUrl = `https://joinposter.com${imageUrl}`;
        }

        return {
          posItemId: p.product_id,
          name: p.product_name,
          description: null,
          price,
          currency: 'UAH',
          category: p.category_name,
          categoryId: p.menu_category_id,
          imageUrl,
          isAvailable: spot?.visible === '1',
          cookingTime: parseInt(p.cooking_time || '0') || null,
          sortOrder: parseInt(p.sort_order || '0'),
          modifications: modifications.length > 0 ? modifications : undefined,
        };
      });
  }

  async createOrder(params: {
    items: {
      posItemId: string;
      qty: number;
      modificationId?: string;
      modifications?: { m: string; a: number }[];
    }[];
    spotId: string;
    comment?: string;
    serviceMode?: number;
    phone?: string;
    firstName?: string;
    lastName?: string;
  }): Promise<POSOrderResult> {
    const products = params.items.map((item) => {
      const product: any = {
        product_id: parseInt(item.posItemId),
        count: item.qty,
      };

      if (item.modificationId) {
        product.modificator_id = parseInt(item.modificationId);
      }

      if (item.modifications && item.modifications.length > 0) {
        product.modification = JSON.stringify(
          item.modifications.map((m) => ({ m: parseInt(m.m), a: m.a })),
        );
      }

      return product;
    });

    const body: any = {
      spot_id: parseInt(params.spotId),
      products,
      service_mode: params.serviceMode || 3,
    };

    if (params.comment) body.comment = params.comment;
    if (params.phone) body.phone = params.phone;
    if (params.firstName) body.first_name = params.firstName;
    if (params.lastName) body.last_name = params.lastName;

    const { data } = await this.client.post('/incomingOrders.createIncomingOrder', body, {
      params: { token: this.token },
    });

    if (!data.response) {
      throw new Error(`Poster: createOrder failed: ${JSON.stringify(data)}`);
    }

    return {
      posOrderId: String(data.response.incoming_order_id),
      status: data.response.status,
    };
  }

  async getOrderStatus(posOrderId: string): Promise<{ status: number; transactionId?: string }> {
    const { data } = await this.client.get('/incomingOrders.getIncomingOrders', {
      params: { token: this.token },
    });

    if (!data.response) return { status: -1 };

    const order = data.response.find(
      (o: any) => String(o.incoming_order_id) === posOrderId,
    );

    if (!order) return { status: -1 };

    return {
      status: parseInt(order.status),
      transactionId: order.transaction_id || undefined,
    };
  }

  verifyWebhook(payload: any, secret: string): boolean {
    const { account, object, object_id, action, data, verify } = payload;
    const str = `${account};${object};${object_id};${action};${data || ''};${secret}`;
    const hash = crypto.createHash('md5').update(str).digest('hex');
    return hash === verify;
  }

  parseWebhook(payload: any) {
    return {
      object: payload.object,
      objectId: String(payload.object_id),
      action: payload.action,
    };
  }
}
