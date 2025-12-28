import axios from 'axios';
import type {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
  Schedule,
  Incident,
} from '../types/api';

// API base URL - will be same origin when served from Express
const API_BASE_URL = '/api/v1';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle 401 errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear tokens and redirect to login
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('idToken');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: async (data: LoginRequest): Promise<LoginResponse> => {
    const response = await apiClient.post<LoginResponse>('/auth/login', data);
    return response.data;
  },

  register: async (data: RegisterRequest): Promise<RegisterResponse> => {
    const response = await apiClient.post<RegisterResponse>('/auth/register', data);
    return response.data;
  },

  logout: () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('idToken');
  },
};

// Schedules API
export const schedulesAPI = {
  list: async (): Promise<{ schedules: Schedule[] }> => {
    const response = await apiClient.get<{ schedules: Schedule[] }>('/schedules');
    return response.data;
  },

  get: async (id: string): Promise<{ schedule: Schedule }> => {
    const response = await apiClient.get<{ schedule: Schedule }>(`/schedules/${id}`);
    return response.data;
  },

  create: async (data: {
    name: string;
    description?: string;
    type?: 'manual' | 'daily' | 'weekly';
    timezone?: string;
  }): Promise<{ schedule: Schedule }> => {
    const response = await apiClient.post<{ schedule: Schedule }>('/schedules', data);
    return response.data;
  },

  setOnCall: async (id: string, userId: string): Promise<{ schedule: Schedule }> => {
    const response = await apiClient.put<{ schedule: Schedule }>(
      `/schedules/${id}/oncall`,
      { userId }
    );
    return response.data;
  },

  createOverride: async (
    id: string,
    data: { userId: string; until: string }
  ): Promise<{ schedule: Schedule }> => {
    const response = await apiClient.post<{ schedule: Schedule }>(
      `/schedules/${id}/override`,
      data
    );
    return response.data;
  },

  removeOverride: async (id: string): Promise<{ schedule: Schedule }> => {
    const response = await apiClient.delete<{ schedule: Schedule }>(
      `/schedules/${id}/override`
    );
    return response.data;
  },
};

// Incidents API
export const incidentsAPI = {
  list: async (): Promise<{ incidents: Incident[] }> => {
    const response = await apiClient.get<{ incidents: Incident[] }>('/incidents');
    return response.data;
  },

  get: async (id: string): Promise<{ incident: Incident }> => {
    const response = await apiClient.get<{ incident: Incident }>(`/incidents/${id}`);
    return response.data;
  },

  acknowledge: async (id: string): Promise<{ incident: Incident }> => {
    const response = await apiClient.post<{ incident: Incident }>(
      `/incidents/${id}/acknowledge`
    );
    return response.data;
  },

  resolve: async (id: string): Promise<{ incident: Incident }> => {
    const response = await apiClient.post<{ incident: Incident }>(
      `/incidents/${id}/resolve`
    );
    return response.data;
  },
};

export default apiClient;
