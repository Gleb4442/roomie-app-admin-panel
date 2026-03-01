import axios from 'axios';
import { getApiBase } from '../utils';
import type {
  OverviewData,
  GuestsResponse,
  OrdersResponse,
  QRCode,
  StatsData,
  SMSLogsResponse,
  ServiceRequestsResponse,
  ServiceStatsData,
  ServiceRequestStatus,
} from '@/types/dashboard';

const api = axios.create({ baseURL: getApiBase() });

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export const dashboardApi = {
  login: async (username: string, password: string) => {
    const res = await api.post('/api/dashboard/auth/login', { username, password });
    return res.data.data as { token: string; manager: { id: string; username: string; role: string; hotels: Array<{ id: string; name: string; slug: string }> } };
  },

  getOverview: async (hotelId: string, token: string): Promise<OverviewData> => {
    const res = await api.get(`/api/dashboard/hotels/${hotelId}/overview`, {
      headers: authHeader(token),
    });
    return res.data.data;
  },

  getGuests: async (
    hotelId: string,
    token: string,
    params: { stage?: string; search?: string; page?: number; limit?: number }
  ): Promise<GuestsResponse> => {
    const res = await api.get(`/api/dashboard/hotels/${hotelId}/guests`, {
      headers: authHeader(token),
      params,
    });
    return res.data.data;
  },

  getOrders: async (
    hotelId: string,
    token: string,
    params: { status?: string; date?: string; page?: number; limit?: number }
  ): Promise<OrdersResponse> => {
    const res = await api.get(`/api/dashboard/hotels/${hotelId}/orders`, {
      headers: authHeader(token),
      params,
    });
    return res.data.data;
  },

  getQRCodes: async (hotelId: string, token: string): Promise<QRCode[]> => {
    const res = await api.get(`/api/dashboard/hotels/${hotelId}/qr`, {
      headers: authHeader(token),
    });
    return res.data.data;
  },

  getStats: async (
    hotelId: string,
    token: string,
    params: { from?: string; to?: string }
  ): Promise<StatsData> => {
    const res = await api.get(`/api/dashboard/hotels/${hotelId}/stats`, {
      headers: authHeader(token),
      params,
    });
    return res.data.data;
  },

  getSmsLogs: async (
    hotelId: string,
    token: string,
    params: { status?: string; page?: number; limit?: number }
  ): Promise<SMSLogsResponse> => {
    const res = await api.get(`/api/dashboard/hotels/${hotelId}/sms-logs`, {
      headers: authHeader(token),
      params,
    });
    return res.data.data;
  },

  getServiceRequests: async (
    hotelId: string,
    token: string,
    params: { status?: string; page?: number; limit?: number }
  ): Promise<ServiceRequestsResponse> => {
    const res = await api.get(`/api/dashboard/hotels/${hotelId}/service-requests`, {
      headers: authHeader(token),
      params,
    });
    return res.data.data;
  },

  updateServiceRequestStatus: async (
    hotelId: string,
    requestId: string,
    status: ServiceRequestStatus,
    token: string,
    rejectionReason?: string
  ) => {
    const res = await api.put(
      `/api/dashboard/hotels/${hotelId}/service-requests/${requestId}/status`,
      { status, rejectionReason },
      { headers: authHeader(token) }
    );
    return res.data;
  },

  getServiceStats: async (hotelId: string, token: string): Promise<ServiceStatsData> => {
    const res = await api.get(`/api/dashboard/hotels/${hotelId}/service-stats`, {
      headers: authHeader(token),
    });
    return res.data.data;
  },

  getOrdersStreamUrl: (hotelId: string, token: string): string =>
    `${getApiBase()}/api/dashboard/hotels/${hotelId}/orders/stream?token=${token}`,

  getServiceRequestsStreamUrl: (hotelId: string, token: string): string =>
    `${getApiBase()}/api/dashboard/hotels/${hotelId}/service-requests/stream?token=${token}`,

  downloadQRPdf: (hotelId: string, qrId: string, token: string): string =>
    `${getApiBase()}/api/dashboard/hotels/${hotelId}/qr/${qrId}/pdf?token=${token}`,

  downloadAllQRZip: (hotelId: string, token: string): string =>
    `${getApiBase()}/api/dashboard/hotels/${hotelId}/qr/download-all?token=${token}`,
};
