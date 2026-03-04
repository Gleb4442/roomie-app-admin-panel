export interface AdminAuthState {
  token: string;
  username: string;
}

export interface HotelListItem {
  id: string;
  name: string;
  slug: string;
  location: string | null;
  timezone: string;
  createdAt: string;
  _count?: { stays: number };
}

export interface HotelDetail {
  id: string;
  name: string;
  slug: string;
  location: string | null;
  timezone: string;
  accentColor: string | null;
  logoUrl: string | null;
  imageUrl: string | null;
  settings: Record<string, unknown>;
  createdAt: string;
}

export interface PMSConfig {
  id?: string;
  hotelId: string;
  pmsType: 'SERVIO' | 'EASYMS' | 'MEWS' | 'OPERA' | 'CLOUDBEDS';
  pmsHotelId: string;
  syncMode: 'POLLING' | 'WEBHOOK' | 'MANUAL' | 'DISABLED';
  isActive: boolean;
  lastSyncAt: string | null;
  credentials: Record<string, string>;
}

export interface SMSConfig {
  id?: string;
  hotelId: string;
  provider: 'TWILIO' | 'TURBOSMS' | 'ESPUTNIK' | 'LOG';
  senderName: string;
  isActive: boolean;
  monthlyLimit: number;
  messagesSent: number;
  credentials: Record<string, string>;
}

export interface POSConfig {
  id?: string;
  hotelId: string;
  posType: string;
  isActive: boolean;
  credentials: Record<string, string>;
}

export interface TMSConfig {
  id?: string;
  hotelId: string;
  mode: 'BUILT_IN' | 'EXTERNAL' | 'HYBRID';
  provider: string;
  enabled: boolean;
  credentials: Record<string, string>;
  categoryMapping: Record<string, string>;
  webhookSecret?: string;
  outgoingWebhookUrl?: string;
  pollingEnabled: boolean;
  pollingIntervalMs: number;
}

export interface AdminQRCode {
  id: string;
  hotelId: string;
  type: string;
  label: string;
  roomNumber: string | null;
  deepLink: string;
  qrImagePath: string | null;
  pdfPath: string | null;
  isActive: boolean;
  scanCount: number;
  createdAt: string;
}

export interface ServiceCategory {
  id: string;
  hotelId: string;
  name: string;
  slug: string;
  icon: string;
  description: string | null;
  requiresRoom: boolean;
  requiresTimeSlot: boolean;
  autoAccept: boolean;
  estimatedMinutes: number;
  items: ServiceItem[];
}

export interface ServiceItem {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  isAvailable: boolean;
  imageUrl: string | null;
}

export interface DashboardManager {
  id: string;
  username: string;
  role: string;
  hotels: Array<{ id: string; name: string; slug: string }>;
  createdAt: string;
}

export interface MonitoringOverview {
  totalHotels: number;
  activeHotels: number;
  totalGuests: number;
  totalOrders: number;
  smsStats: {
    total: number;
    sent: number;
    failed: number;
    queued: number;
  };
  pmsSync: {
    active: number;
    withErrors: number;
    lastErrors: Array<{ hotelId: string; hotelName: string; error: string; at: string }>;
  };
}

export interface SMSError {
  id: string;
  hotelId: string;
  hotelName: string;
  phone: string;
  template: string;
  provider: string;
  errorMsg: string;
  createdAt: string;
}
