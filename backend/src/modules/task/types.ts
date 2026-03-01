export interface TMSTask {
  title: string;
  description: string;
  categoryId: string;
  roomNumber?: string;
  priority: 'low' | 'medium' | 'high';
  guestName?: string;
  items: Array<{ name: string; quantity: number }>;
  requestedTime?: Date;
}

export interface CreateRequestParams {
  hotelId: string;
  guestId: string;
  guestStayId: string;
  categoryId: string;
  items: Array<{ serviceItemId: string; quantity: number }>;
  roomNumber?: string;
  comment?: string;
  requestedTime?: Date;
}

export interface HotelRequestFilters {
  status?: string;
  categorySlug?: string;
  roomNumber?: string;
  from?: Date;
  to?: Date;
  page?: number;
  limit?: number;
}

export const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  pending: ['accepted', 'rejected', 'cancelled'],
  accepted: ['in_progress', 'cancelled'],
  in_progress: ['completed'],
};

export const SERVICE_REQUEST_STATUSES = [
  'pending',
  'accepted',
  'in_progress',
  'completed',
  'rejected',
  'cancelled',
] as const;

export type ServiceRequestStatus = (typeof SERVICE_REQUEST_STATUSES)[number];
