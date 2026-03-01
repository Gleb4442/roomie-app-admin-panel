export interface POSMenuItem {
  posItemId: string;
  name: string;
  description?: string;
  price: number;
  currency: string;
  category: string;
  categoryId: string;
  imageUrl?: string;
  isAvailable: boolean;
  cookingTime?: number;
  sortOrder: number;
  modifications?: POSModificationGroup[];
}

export interface POSModificationGroup {
  groupId: string;
  name: string;
  minQty: number;
  maxQty: number;
  options: { id: string; name: string; price: number }[];
}

export interface POSOrderResult {
  posOrderId: string;
  status: number;
}

export interface POSAdapter {
  getMenu(): Promise<POSMenuItem[]>;
  getCategories(): Promise<{ id: string; name: string; photo?: string; sortOrder: number }[]>;
  createOrder(params: {
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
  }): Promise<POSOrderResult>;
  getOrderStatus(posOrderId: string): Promise<{ status: number; transactionId?: string }>;
  verifyWebhook(payload: any, secret: string): boolean;
  parseWebhook(payload: any): { object: string; objectId: string; action: string };
}
