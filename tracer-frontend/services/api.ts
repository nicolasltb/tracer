import axios, { AxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';
import {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RefreshRequest,
  User,
  WalletInfo,
  Batch,
  BatchDetail,
  BatchCreateResponse,
  EventChainData,
  CreateBatchRequest,
  UpdateBatchStatusRequest,
  UpdateUserRequest,
  QRTokenInfo,
  QRScanRequest,
  QRScanResponse,
  TraceResponse,
} from '@/types';
import { useAuthStore } from '@/store/auth';

const BASE_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:8000') + '/api/v1';

// Re-exported for backwards compat — prefer importing from @/constants/storage directly
export { TOKEN_KEY, REFRESH_TOKEN_KEY } from '@/constants/storage';
import { TOKEN_KEY, REFRESH_TOKEN_KEY } from '@/constants/storage';

const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

// Request interceptor: attach access token
apiClient.interceptors.request.use(
  async (config) => {
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    if (token) {
      config.headers = config.headers ?? {};
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: refresh on 401
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
        if (!refreshToken) {
          return Promise.reject(error);
        }

        const response = await axios.post<LoginResponse>(`${BASE_URL}/auth/refresh`, {
          refresh_token: refreshToken,
        });

        const { access_token, refresh_token: newRefreshToken } = response.data;

        await SecureStore.setItemAsync(TOKEN_KEY, access_token);
        await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, newRefreshToken);

        if (originalRequest.headers) {
          originalRequest.headers['Authorization'] = `Bearer ${access_token}`;
        }

        return apiClient(originalRequest);
      } catch {
        await useAuthStore.getState().logout();
        router.replace('/(auth)/login');
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  login: async (data: LoginRequest): Promise<LoginResponse> => {
    const response = await apiClient.post<LoginResponse>('/auth/login', data);
    return response.data;
  },

  register: async (data: RegisterRequest): Promise<User> => {
    const response = await apiClient.post<User>('/auth/register', data);
    return response.data;
  },

  refresh: async (data: RefreshRequest): Promise<LoginResponse> => {
    const response = await apiClient.post<LoginResponse>('/auth/refresh', data);
    return response.data;
  },
};

// Users API
export const usersApi = {
  me: async (): Promise<User> => {
    const response = await apiClient.get<User>('/users/me');
    return response.data;
  },

  wallet: async (): Promise<WalletInfo> => {
    const response = await apiClient.get<WalletInfo>('/users/me/wallet');
    return response.data;
  },

  update: async (data: UpdateUserRequest): Promise<User> => {
    const response = await apiClient.patch<User>('/users/me', data);
    return response.data;
  },
};

// Batches API
export const batchesApi = {
  list: async (): Promise<Batch[]> => {
    const response = await apiClient.get<Batch[]>('/batches/');
    return response.data;
  },

  get: async (id: string): Promise<BatchDetail> => {
    const response = await apiClient.get<BatchDetail>(`/batches/${id}`);
    return response.data;
  },

  create: async (data: CreateBatchRequest): Promise<BatchCreateResponse> => {
    const response = await apiClient.post<BatchCreateResponse>('/batches/', data);
    return response.data;
  },

  updateStatus: async (id: string, data: UpdateBatchStatusRequest): Promise<Batch> => {
    const response = await apiClient.patch<Batch>(`/batches/${id}/status`, data);
    return response.data;
  },
};

// Events API
export const eventsApi = {
  list: async (batchId: string): Promise<EventChainData[]> => {
    const response = await apiClient.get<EventChainData[]>(`/batches/${batchId}/events/`);
    return response.data;
  },
};

// QR Code API
export const qrApi = {
  info: async (token: string): Promise<QRTokenInfo> => {
    const response = await apiClient.get<QRTokenInfo>(`/qr/${token}`);
    return response.data;
  },

  scan: async (token: string, data: QRScanRequest): Promise<QRScanResponse> => {
    const response = await apiClient.post<QRScanResponse>(`/qr/${token}/scan`, data);
    return response.data;
  },

  batchActiveQr: async (batchId: string): Promise<QRTokenInfo> => {
    const response = await apiClient.get<QRTokenInfo>(`/batches/${batchId}/qr`);
    return response.data;
  },

  trace: async (token: string): Promise<TraceResponse> => {
    const response = await apiClient.get<TraceResponse>(`/trace/${token}`);
    return response.data;
  },

  imageUrl: (token: string): string => `${BASE_URL}/qr/${token}/image`,
};

export default apiClient;
