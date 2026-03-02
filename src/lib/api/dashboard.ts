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

  // ── Staff TMS ──────────────────────────────────────────────

  getStaffList: async (hotelId: string, token: string): Promise<StaffMember[]> => {
    const res = await api.get(`/api/dashboard/staff/${hotelId}`, {
      headers: authHeader(token),
    });
    return res.data;
  },

  createStaff: async (hotelId: string, token: string, data: CreateStaffData): Promise<StaffMember> => {
    const res = await api.post(`/api/dashboard/staff/${hotelId}`, data, {
      headers: authHeader(token),
    });
    return res.data;
  },

  updateStaff: async (hotelId: string, staffId: string, token: string, data: UpdateStaffData): Promise<StaffMember> => {
    const res = await api.patch(`/api/dashboard/staff/${hotelId}/${staffId}`, data, {
      headers: authHeader(token),
    });
    return res.data;
  },

  deactivateStaff: async (hotelId: string, staffId: string, token: string) => {
    const res = await api.delete(`/api/dashboard/staff/${hotelId}/${staffId}`, {
      headers: authHeader(token),
    });
    return res.data;
  },

  resetStaffPin: async (hotelId: string, staffId: string, token: string, pin: string) => {
    const res = await api.post(
      `/api/dashboard/staff/${hotelId}/${staffId}/reset-pin`,
      { pin },
      { headers: authHeader(token) },
    );
    return res.data;
  },

  getTMSStats: async (hotelId: string, token: string): Promise<TMSStats> => {
    const res = await api.get(`/api/dashboard/staff/${hotelId}/stats`, {
      headers: authHeader(token),
    });
    return res.data;
  },

  // ── Templates ─────────────────────────────────────────────

  getTemplates: async (hotelId: string, token: string): Promise<TaskTemplate[]> => {
    const res = await api.get(`/api/dashboard/staff/${hotelId}/templates`, {
      headers: authHeader(token),
    });
    return res.data;
  },

  createTemplate: async (hotelId: string, token: string, data: TemplateFormData): Promise<TaskTemplate> => {
    const res = await api.post(`/api/dashboard/staff/${hotelId}/templates`, data, {
      headers: authHeader(token),
    });
    return res.data;
  },

  updateTemplate: async (
    hotelId: string,
    templateId: string,
    token: string,
    data: Partial<TemplateFormData>,
  ): Promise<TaskTemplate> => {
    const res = await api.patch(
      `/api/dashboard/staff/${hotelId}/templates/${templateId}`,
      data,
      { headers: authHeader(token) },
    );
    return res.data;
  },

  deleteTemplate: async (hotelId: string, templateId: string, token: string) => {
    const res = await api.delete(
      `/api/dashboard/staff/${hotelId}/templates/${templateId}`,
      { headers: authHeader(token) },
    );
    return res.data;
  },
};

// ── Staff TMS Types ──────────────────────────────────────────

export interface StaffMember {
  id: string;
  email: string;
  phone?: string;
  firstName: string;
  lastName?: string;
  role: string;
  department: string;
  isActive: boolean;
  assignedFloor?: string;
  avatarUrl?: string;
  createdAt: string;
  shifts?: { startedAt: string }[];
}

export interface CreateStaffData {
  email: string;
  firstName: string;
  lastName?: string;
  phone?: string;
  role: string;
  department: string;
  password: string;
  assignedFloor?: string;
}

export interface UpdateStaffData {
  firstName?: string;
  lastName?: string;
  phone?: string;
  role?: string;
  department?: string;
  isActive?: boolean;
  assignedFloor?: string;
  password?: string;
}

export interface TMSStats {
  byStatus: { status: string; count: number }[];
  byDepartment: { department: string; count: number }[];
  slaCompliance: number | null;
  slaTotal: number;
  totalTasks: number;
}

export interface ChecklistItemData {
  id?: string;
  text: string;
  isRequired: boolean;
  sortOrder: number;
}

export interface TaskTemplate {
  id: string;
  hotelId: string;
  name: string;
  department: string;
  defaultPriority: string;
  slaMinutes?: number | null;
  isActive: boolean;
  createdAt: string;
  checklistItems: ChecklistItemData[];
}

export interface TemplateFormData {
  name: string;
  department: string;
  defaultPriority: string;
  slaMinutes?: number | null;
  isActive?: boolean;
  checklistItems: { text: string; isRequired: boolean; sortOrder: number }[];
}
