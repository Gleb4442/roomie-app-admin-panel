export interface Hotel {
  id: string;
  name: string;
  slug: string;
}

export interface DashboardManager {
  id: string;
  username: string;
  role: string;
  hotels: Hotel[];
}

export interface AuthState {
  token: string;
  manager: DashboardManager;
}

// Overview
export interface RecentOrder {
  id: string;
  roomNumber: string;
  guestName: string;
  items: string;
  status: OrderStatus;
  totalAmount: number;
  createdAt: string;
}

export interface RecentStageChange {
  guestName: string;
  fromStage: JourneyStage;
  toStage: JourneyStage;
  roomNumber: string;
  changedAt: string;
}

export interface OverviewData {
  todayGuests: number;
  todayOrders: number;
  todayQRScans: number;
  todaySMS: number;
  todayRevenue: number;
  recentOrders: RecentOrder[];
  recentGuestChanges: RecentStageChange[];
}

// Guests
export type JourneyStage =
  | 'PRE_ARRIVAL'
  | 'CHECKED_IN'
  | 'IN_STAY'
  | 'CHECKOUT'
  | 'POST_STAY'
  | 'BETWEEN_STAYS';

export interface GuestRow {
  id: string;
  guestName: string;
  phone: string;
  email: string;
  roomNumber: string;
  stage: JourneyStage;
  checkIn: string;
  checkOut: string;
  source: string;
  preCheckinCompleted: boolean;
}

export interface GuestsResponse {
  guests: GuestRow[];
  total: number;
  page: number;
  totalPages: number;
}

// Orders
export type OrderStatus =
  | 'PENDING'
  | 'SENT_TO_POS'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'READY'
  | 'IN_TRANSIT'
  | 'DELIVERED'
  | 'COMPLETED'
  | 'CANCELLED';

export interface OrderItem {
  name: string;
  quantity: number;
  price: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  roomNumber: string;
  guestName: string;
  items: OrderItem[];
  totalAmount: number;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
}

export interface OrdersResponse {
  orders: Order[];
  total: number;
  page: number;
  totalPages: number;
}

// SSE events
export type OrderSSEEvent =
  | { type: 'order_created'; order: Order }
  | { type: 'order_status_changed'; orderId: string; status: OrderStatus; updatedAt: string }
  | { type: 'order_completed'; orderId: string };

// QR
export interface QRCode {
  id: string;
  hotelId: string;
  type: string;
  label: string;
  roomNumber: string;
  deepLink: string;
  qrImagePath: string;
  pdfPath: string;
  isActive: boolean;
  scanCount: number;
  createdAt: string;
}

// Stats
export interface DailyAppOpen {
  date: string;
  uniqueGuests: number;
  totalOpens: number;
}

export interface DailyOrder {
  date: string;
  count: number;
  revenue: number;
}

export interface TopItem {
  name: string;
  count: number;
  revenue: number;
}

export interface DailyStat {
  date: string;
  count: number;
}

export interface StatsData {
  appOpens: {
    daily: DailyAppOpen[];
    totalUnique: number;
  };
  orders: {
    daily: DailyOrder[];
    totalCount: number;
    totalRevenue: number;
    averageCheck: number;
    topItems: TopItem[];
  };
  sms: {
    total: number;
    delivered: number;
    failed: number;
    byTemplate: Array<{ template: string; count: number }>;
  };
  qrScans: {
    daily: DailyStat[];
    byRoom: Array<{ roomNumber: string; count: number }>;
    total: number;
  };
  guestJourney: {
    preArrival: number;
    inStay: number;
    postStay: number;
    preCheckinConversion: number;
    totalGuestsInPeriod: number;
  };
  reservations: {
    daily: DailyStat[];
    bySource: Array<{ source: string; count: number }>;
    total: number;
  };
}

// SMS Logs
export interface SMSLog {
  id: string;
  phone: string;
  template: string;
  provider: string;
  status: 'queued' | 'sent' | 'failed';
  errorMsg: string | null;
  sentAt: string;
  createdAt: string;
}

export interface SMSLogsResponse {
  logs: SMSLog[];
  total: number;
  page: number;
  totalPages: number;
}

// Service Requests
export type ServiceRequestStatus = 'pending' | 'accepted' | 'in_progress' | 'completed' | 'rejected';

export interface ServiceRequestItem {
  id: string;
  serviceItemId: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  serviceItem?: { name: string };
}

export interface ServiceRequest {
  id: string;
  hotelId: string;
  guestId: string;
  roomNumber: string;
  comment: string;
  requestedTime: string | null;
  scheduledTime: string | null;
  status: ServiceRequestStatus;
  rejectionReason: string | null;
  completedAt: string | null;
  totalAmount: number;
  isPaid: boolean;
  createdAt: string;
  guest?: { firstName: string; lastName: string };
  category?: { name: string; icon: string };
  items: ServiceRequestItem[];
}

export interface ServiceRequestsResponse {
  requests: ServiceRequest[];
  total: number;
  page: number;
  totalPages: number;
}

export interface ServiceStatsData {
  total: number;
  byStatus: Record<ServiceRequestStatus, number>;
  byCategory: Array<{ name: string; count: number }>;
  averageCompletionMinutes: number;
  todayRevenue: number;
}
