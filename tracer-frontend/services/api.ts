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
  Property,
  PropertyDetail,
  CreatePropertyRequest,
  UpdatePropertyRequest,
  PropertyArea,
  CreatePropertyAreaRequest,
  WaterSource,
  CreateWaterSourceRequest,
  SaleRecord,
  CreateSaleRequest,
  Certification,
  Document,
  DocumentType,
  Audit,
  AuditDetail,
  AuditSubmitResponse,
  CreateAuditRequest,
  UpsertCheckRequest,
  SubmitAuditRequest,
  ComplianceCheck,
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

// Properties API
export const propertiesApi = {
  list: async (): Promise<Property[]> => {
    const response = await apiClient.get<Property[]>('/properties/');
    return response.data;
  },

  get: async (id: string): Promise<PropertyDetail> => {
    const response = await apiClient.get<PropertyDetail>(`/properties/${id}`);
    return response.data;
  },

  create: async (data: CreatePropertyRequest): Promise<Property> => {
    const response = await apiClient.post<Property>('/properties/', data);
    return response.data;
  },

  update: async (id: string, data: UpdatePropertyRequest): Promise<Property> => {
    const response = await apiClient.patch<Property>(`/properties/${id}`, data);
    return response.data;
  },

  // Areas
  listAreas: async (propertyId: string): Promise<PropertyArea[]> => {
    const response = await apiClient.get<PropertyArea[]>(`/properties/${propertyId}/areas`);
    return response.data;
  },

  createArea: async (
    propertyId: string,
    data: CreatePropertyAreaRequest
  ): Promise<PropertyArea> => {
    const response = await apiClient.post<PropertyArea>(
      `/properties/${propertyId}/areas`,
      data
    );
    return response.data;
  },

  deleteArea: async (propertyId: string, areaId: string): Promise<void> => {
    await apiClient.delete(`/properties/${propertyId}/areas/${areaId}`);
  },

  // Water sources
  listWaterSources: async (propertyId: string): Promise<WaterSource[]> => {
    const response = await apiClient.get<WaterSource[]>(
      `/properties/${propertyId}/water-sources`
    );
    return response.data;
  },

  createWaterSource: async (
    propertyId: string,
    data: CreateWaterSourceRequest
  ): Promise<WaterSource> => {
    const response = await apiClient.post<WaterSource>(
      `/properties/${propertyId}/water-sources`,
      data
    );
    return response.data;
  },

  deleteWaterSource: async (propertyId: string, wsId: string): Promise<void> => {
    await apiClient.delete(`/properties/${propertyId}/water-sources/${wsId}`);
  },

  // Sales
  listSales: async (propertyId: string): Promise<SaleRecord[]> => {
    const response = await apiClient.get<SaleRecord[]>(
      `/properties/${propertyId}/sales`
    );
    return response.data;
  },

  createSale: async (
    propertyId: string,
    data: CreateSaleRequest
  ): Promise<SaleRecord> => {
    const response = await apiClient.post<SaleRecord>(
      `/properties/${propertyId}/sales`,
      data
    );
    return response.data;
  },

  // Certification
  getCertification: async (propertyId: string): Promise<Certification | null> => {
    const response = await apiClient.get<Certification | null>(
      `/properties/${propertyId}/certification`
    );
    return response.data;
  },
};

// Documents API
export interface UploadDocumentInput {
  uri: string;
  name: string;
  mimeType: string;
  docType: DocumentType;
  propertyId?: string;
  auditId?: string;
}

export const documentsApi = {
  upload: async (input: UploadDocumentInput): Promise<Document> => {
    const form = new FormData();
    // React Native's FormData accepts { uri, name, type } for file fields
    form.append('file', {
      uri: input.uri,
      name: input.name,
      type: input.mimeType,
    } as unknown as Blob);
    form.append('doc_type', input.docType);
    if (input.propertyId) form.append('property_id', input.propertyId);
    if (input.auditId) form.append('audit_id', input.auditId);

    const response = await apiClient.post<Document>('/documents/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000,
    });
    return response.data;
  },

  meta: async (id: string): Promise<Document> => {
    const response = await apiClient.get<Document>(`/documents/${id}/meta`);
    return response.data;
  },

  fileUrl: (id: string): string => `${BASE_URL}/documents/${id}`,
};

// Audits API
export const auditsApi = {
  list: async (): Promise<Audit[]> => {
    const response = await apiClient.get<Audit[]>('/audits/');
    return response.data;
  },

  get: async (id: string): Promise<AuditDetail> => {
    const response = await apiClient.get<AuditDetail>(`/audits/${id}`);
    return response.data;
  },

  create: async (data: CreateAuditRequest): Promise<Audit> => {
    const response = await apiClient.post<Audit>('/audits/', data);
    return response.data;
  },

  upsertCheck: async (
    auditId: string,
    data: UpsertCheckRequest
  ): Promise<ComplianceCheck> => {
    const response = await apiClient.post<ComplianceCheck>(
      `/audits/${auditId}/checks`,
      data
    );
    return response.data;
  },

  submit: async (
    auditId: string,
    data: SubmitAuditRequest
  ): Promise<AuditSubmitResponse> => {
    const response = await apiClient.post<AuditSubmitResponse>(
      `/audits/${auditId}/submit`,
      data
    );
    return response.data;
  },
};

export default apiClient;
