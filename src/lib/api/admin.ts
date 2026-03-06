import axios from 'axios';
import { getApiBase } from '../utils';
import type {
  HotelListItem,
  HotelDetail,
  PMSConfig,
  SMSConfig,
  POSConfig,
  TMSConfig,
  AdminQRCode,
  ServiceCategory,
  DashboardManager,
  MonitoringOverview,
} from '@/types/admin';

const api = axios.create({ baseURL: getApiBase() });

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export const adminApi = {
  login: async (username: string, password: string) => {
    const res = await api.post('/api/admin/auth/login', { username, password });
    return res.data.data as { token: string; username: string };
  },

  // Hotels
  listHotels: async (token: string): Promise<HotelListItem[]> => {
    const res = await api.get('/api/admin/hotels', { headers: authHeader(token) });
    return res.data.data;
  },
  createHotel: async (token: string, data: Partial<HotelDetail>) => {
    const res = await api.post('/api/admin/hotels', data, { headers: authHeader(token) });
    return res.data.data;
  },
  getHotel: async (token: string, hotelId: string): Promise<HotelDetail> => {
    const res = await api.get(`/api/admin/hotels/${hotelId}`, { headers: authHeader(token) });
    return res.data.data;
  },
  updateHotel: async (token: string, hotelId: string, data: Partial<HotelDetail>) => {
    const res = await api.put(`/api/admin/hotels/${hotelId}`, data, { headers: authHeader(token) });
    return res.data.data;
  },
  deleteHotel: async (token: string, hotelId: string) => {
    await api.delete(`/api/admin/hotels/${hotelId}`, { headers: authHeader(token) });
  },
  updateBranding: async (token: string, hotelId: string, data: { accentColor?: string; welcomeMessage?: string }) => {
    const res = await api.put(`/api/admin/hotels/${hotelId}/branding`, data, { headers: authHeader(token) });
    return res.data.data;
  },
  uploadLogo: async (token: string, hotelId: string, file: File) => {
    const fd = new FormData();
    fd.append('logo', file);
    const res = await api.post(`/api/admin/hotels/${hotelId}/branding/logo`, fd, {
      headers: { ...authHeader(token), 'Content-Type': 'multipart/form-data' },
    });
    return res.data.data;
  },

  // PMS
  getPmsConfig: async (token: string, hotelId: string): Promise<PMSConfig | null> => {
    try {
      const res = await api.get(`/api/admin/hotels/${hotelId}/pms`, { headers: authHeader(token) });
      return res.data.data;
    } catch { return null; }
  },
  upsertPmsConfig: async (token: string, hotelId: string, data: Partial<PMSConfig>) => {
    const res = await api.put(`/api/admin/hotels/${hotelId}/pms`, data, { headers: authHeader(token) });
    return res.data.data;
  },
  deletePmsConfig: async (token: string, hotelId: string) => {
    await api.delete(`/api/admin/hotels/${hotelId}/pms`, { headers: authHeader(token) });
  },
  testPmsConnection: async (token: string, hotelId: string): Promise<{ success: boolean; message: string }> => {
    const res = await api.post(`/api/admin/hotels/${hotelId}/pms/test`, {}, { headers: authHeader(token) });
    return res.data.data;
  },
  syncPms: async (token: string, hotelId: string) => {
    const res = await api.post(`/api/admin/hotels/${hotelId}/pms/sync`, {}, { headers: authHeader(token) });
    return res.data;
  },
  getPmsSyncLogs: async (token: string, hotelId: string) => {
    const res = await api.get(`/api/admin/hotels/${hotelId}/pms/sync-logs`, { headers: authHeader(token) });
    return res.data.data;
  },

  // SMS
  getSmsConfig: async (token: string, hotelId: string): Promise<SMSConfig | null> => {
    try {
      const res = await api.get(`/api/admin/hotels/${hotelId}/sms`, { headers: authHeader(token) });
      return res.data.data;
    } catch { return null; }
  },
  upsertSmsConfig: async (token: string, hotelId: string, data: Partial<SMSConfig>) => {
    const res = await api.put(`/api/admin/hotels/${hotelId}/sms`, data, { headers: authHeader(token) });
    return res.data.data;
  },
  testSms: async (token: string, hotelId: string, phone: string) => {
    const res = await api.post(`/api/admin/hotels/${hotelId}/sms/test`, { phone }, { headers: authHeader(token) });
    return res.data;
  },

  // POS
  getPosConfig: async (token: string, hotelId: string): Promise<POSConfig | null> => {
    try {
      const res = await api.get(`/api/admin/hotels/${hotelId}/pos`, { headers: authHeader(token) });
      return res.data.data;
    } catch { return null; }
  },
  upsertPosConfig: async (token: string, hotelId: string, data: Partial<POSConfig>) => {
    const res = await api.put(`/api/admin/hotels/${hotelId}/pos`, data, { headers: authHeader(token) });
    return res.data.data;
  },
  testPosConnection: async (token: string, hotelId: string) => {
    const res = await api.post(`/api/admin/hotels/${hotelId}/pos/test`, {}, { headers: authHeader(token) });
    return res.data;
  },
  syncPosMenu: async (token: string, hotelId: string) => {
    const res = await api.post(`/api/admin/hotels/${hotelId}/pos/sync-menu`, {}, { headers: authHeader(token) });
    return res.data;
  },

  // QR
  listQR: async (token: string, hotelId: string): Promise<AdminQRCode[]> => {
    const res = await api.get(`/api/admin/hotels/${hotelId}/qr`, { headers: authHeader(token) });
    return res.data.data;
  },
  generateQR: async (token: string, hotelId: string, data: { type: string; label: string; roomNumber?: string }) => {
    const res = await api.post(`/api/admin/hotels/${hotelId}/qr/generate`, data, { headers: authHeader(token) });
    return res.data.data;
  },
  generateQRBulk: async (token: string, hotelId: string, rooms: string[]) => {
    const res = await api.post(`/api/admin/hotels/${hotelId}/qr/generate-bulk`, { rooms }, { headers: authHeader(token) });
    return res.data.data;
  },
  regenerateAllQR: async (token: string, hotelId: string) => {
    const res = await api.post(`/api/admin/hotels/${hotelId}/qr/regenerate`, {}, { headers: authHeader(token) });
    return res.data;
  },
  deleteQR: async (token: string, hotelId: string, qrId: string) => {
    await api.delete(`/api/admin/hotels/${hotelId}/qr/${qrId}`, { headers: authHeader(token) });
  },

  // Service Categories
  listServiceCategories: async (token: string, hotelId: string): Promise<ServiceCategory[]> => {
    const res = await api.get(`/api/admin/hotels/${hotelId}/service-categories`, { headers: authHeader(token) });
    return res.data.data;
  },
  createServiceCategory: async (token: string, hotelId: string, data: Partial<ServiceCategory>) => {
    const res = await api.post(`/api/admin/hotels/${hotelId}/service-categories`, data, { headers: authHeader(token) });
    return res.data.data;
  },
  updateServiceCategory: async (token: string, hotelId: string, id: string, data: Partial<ServiceCategory>) => {
    const res = await api.put(`/api/admin/hotels/${hotelId}/service-categories/${id}`, data, { headers: authHeader(token) });
    return res.data.data;
  },
  deleteServiceCategory: async (token: string, hotelId: string, id: string) => {
    await api.delete(`/api/admin/hotels/${hotelId}/service-categories/${id}`, { headers: authHeader(token) });
  },
  seedServiceCategories: async (token: string, hotelId: string) => {
    const res = await api.post(`/api/admin/hotels/${hotelId}/service-categories/seed`, {}, { headers: authHeader(token) });
    return res.data;
  },
  createServiceItem: async (token: string, hotelId: string, catId: string, data: Partial<ServiceCategory['items'][0]>) => {
    const res = await api.post(`/api/admin/hotels/${hotelId}/service-categories/${catId}/items`, data, { headers: authHeader(token) });
    return res.data.data;
  },
  updateServiceItem: async (token: string, hotelId: string, catId: string, id: string, data: Partial<ServiceCategory['items'][0]>) => {
    const res = await api.put(`/api/admin/hotels/${hotelId}/service-categories/${catId}/items/${id}`, data, { headers: authHeader(token) });
    return res.data.data;
  },
  deleteServiceItem: async (token: string, hotelId: string, catId: string, id: string) => {
    await api.delete(`/api/admin/hotels/${hotelId}/service-categories/${catId}/items/${id}`, { headers: authHeader(token) });
  },

  // TMS
  getTmsConfig: async (token: string, hotelId: string): Promise<TMSConfig | null> => {
    try {
      const res = await api.get(`/api/admin/hotels/${hotelId}/tms`, { headers: authHeader(token) });
      return res.data.data;
    } catch { return null; }
  },
  upsertTmsConfig: async (token: string, hotelId: string, data: Partial<TMSConfig>) => {
    const res = await api.put(`/api/admin/hotels/${hotelId}/tms`, data, { headers: authHeader(token) });
    return res.data.data;
  },
  testTmsConnection: async (token: string, hotelId: string) => {
    const res = await api.post(`/api/admin/hotels/${hotelId}/tms/test`, {}, { headers: authHeader(token) });
    return res.data;
  },

  // Monitoring
  getMonitoringOverview: async (token: string): Promise<MonitoringOverview> => {
    const res = await api.get('/api/admin/monitoring/overview', { headers: authHeader(token) });
    return res.data.data;
  },
  getSmsErrors: async (token: string) => {
    const res = await api.get('/api/admin/monitoring/sms-errors', { headers: authHeader(token) });
    return res.data.data;
  },

  // Managers
  listManagers: async (token: string): Promise<DashboardManager[]> => {
    const res = await api.get('/api/admin/managers', { headers: authHeader(token) });
    return res.data.data;
  },
  createManager: async (token: string, data: { username: string; password: string; role: string }) => {
    const res = await api.post('/api/admin/managers', data, { headers: authHeader(token) });
    return res.data.data;
  },
  updateManager: async (token: string, managerId: string, data: { username?: string; password?: string }) => {
    const res = await api.put(`/api/admin/managers/${managerId}`, data, { headers: authHeader(token) });
    return res.data.data;
  },
  deleteManager: async (token: string, managerId: string) => {
    await api.delete(`/api/admin/managers/${managerId}`, { headers: authHeader(token) });
  },
  linkManagerHotels: async (token: string, managerId: string, hotelIds: string[]) => {
    const res = await api.post(`/api/admin/managers/${managerId}/hotels`, { hotelIds }, { headers: authHeader(token) });
    return res.data.data;
  },

  // Staff
  listStaff: async (token: string, hotelId: string): Promise<AdminStaffMember[]> => {
    const res = await api.get(`/api/admin/hotels/${hotelId}/staff`, { headers: authHeader(token) });
    return res.data.data;
  },
  createStaff: async (token: string, hotelId: string, data: CreateAdminStaffData) => {
    const res = await api.post(`/api/admin/hotels/${hotelId}/staff`, data, { headers: authHeader(token) });
    return res.data.data as AdminStaffMember;
  },
  updateStaff: async (token: string, hotelId: string, staffId: string, data: Partial<CreateAdminStaffData>) => {
    const res = await api.patch(`/api/admin/hotels/${hotelId}/staff/${staffId}`, data, { headers: authHeader(token) });
    return res.data.data as AdminStaffMember;
  },
  deactivateStaff: async (token: string, hotelId: string, staffId: string) => {
    await api.delete(`/api/admin/hotels/${hotelId}/staff/${staffId}`, { headers: authHeader(token) });
  },
  resetStaffPin: async (token: string, hotelId: string, staffId: string, pin: string) => {
    await api.post(`/api/admin/hotels/${hotelId}/staff/${staffId}/reset-pin`, { pin }, { headers: authHeader(token) });
  },
};

export interface AdminStaffMember {
  id: string;
  hotelId: string;
  email: string;
  firstName: string;
  lastName: string | null;
  phone: string | null;
  role: string;
  department: string;
  isActive: boolean;
  assignedFloor: string | null;
  shifts?: { isActive: boolean }[];
  createdAt: string;
}

export interface CreateAdminStaffData {
  email: string;
  firstName: string;
  lastName?: string;
  phone?: string;
  role: string;
  department: string;
  password: string;
  assignedFloor?: string;
}
