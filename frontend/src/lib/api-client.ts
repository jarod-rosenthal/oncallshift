import axios from 'axios';
import type {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
  Schedule,
  Incident,
  UserAvailability,
  User,
  OnCallInfo,
  ScheduleMember,
  UpdateProfileRequest,
  UpdateProfileResponse,
  Service,
  InviteUserRequest,
  CreateServiceRequest,
  UpdateServiceRequest,
  IncidentDetailResponse,
  IncidentTimelineResponse,
  Runbook,
  CreateRunbookRequest,
  UpdateRunbookRequest,
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

  getOnCall: async (): Promise<{ oncall: OnCallInfo[] }> => {
    const response = await apiClient.get<{ oncall: OnCallInfo[] }>('/schedules/oncall');
    return response.data;
  },

  getWeeklyForecast: async (): Promise<{
    forecast: Array<{
      schedule: { id: string; name: string; type: string };
      days: Array<{
        date: string;
        dayOfWeek: string;
        isToday: boolean;
        oncallUser: { id: string; fullName: string; email: string } | null;
      }>;
    }>;
    weekStart: string;
    generated: string;
  }> => {
    const response = await apiClient.get('/schedules/weekly-forecast');
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

  // Schedule Members
  getMembers: async (scheduleId: string): Promise<{ members: ScheduleMember[] }> => {
    const response = await apiClient.get<{ members: ScheduleMember[] }>(
      `/schedules/${scheduleId}/members`
    );
    return response.data;
  },

  addMember: async (scheduleId: string, userId: string): Promise<{ member: ScheduleMember }> => {
    const response = await apiClient.post<{ member: ScheduleMember }>(
      `/schedules/${scheduleId}/members`,
      { userId }
    );
    return response.data;
  },

  removeMember: async (scheduleId: string, memberId: string): Promise<void> => {
    await apiClient.delete(`/schedules/${scheduleId}/members/${memberId}`);
  },

  reorderMember: async (scheduleId: string, memberId: string, position: number): Promise<void> => {
    await apiClient.put(`/schedules/${scheduleId}/members/${memberId}/position`, { position });
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/schedules/${id}`);
  },
};

// Incidents API
export const incidentsAPI = {
  list: async (): Promise<{ incidents: Incident[] }> => {
    const response = await apiClient.get<{ incidents: Incident[] }>('/incidents');
    return response.data;
  },

  get: async (id: string): Promise<IncidentDetailResponse> => {
    const response = await apiClient.get<IncidentDetailResponse>(`/incidents/${id}`);
    return response.data;
  },

  getTimeline: async (id: string): Promise<IncidentTimelineResponse> => {
    const response = await apiClient.get<IncidentTimelineResponse>(`/incidents/${id}/timeline`);
    return response.data;
  },

  addNote: async (id: string, content: string): Promise<{ event: { id: string; type: string; message: string; createdAt: string }; message: string }> => {
    const response = await apiClient.post(`/incidents/${id}/notes`, { content });
    return response.data;
  },

  acknowledge: async (id: string): Promise<{ incident: Incident }> => {
    const response = await apiClient.put<{ incident: Incident }>(
      `/incidents/${id}/acknowledge`
    );
    return response.data;
  },

  resolve: async (id: string, note?: string): Promise<{ incident: Incident }> => {
    const response = await apiClient.put<{ incident: Incident }>(
      `/incidents/${id}/resolve`,
      note ? { note } : undefined
    );
    return response.data;
  },

  unacknowledge: async (id: string): Promise<{ incident: Incident; message: string }> => {
    const response = await apiClient.put<{ incident: Incident; message: string }>(
      `/incidents/${id}/unacknowledge`
    );
    return response.data;
  },

  unresolve: async (id: string): Promise<{ incident: Incident; message: string }> => {
    const response = await apiClient.put<{ incident: Incident; message: string }>(
      `/incidents/${id}/unresolve`
    );
    return response.data;
  },

  snooze: async (id: string, durationMinutes: number, reason?: string): Promise<{ incident: Incident; message: string }> => {
    const response = await apiClient.post<{ incident: Incident; message: string }>(
      `/incidents/${id}/snooze`,
      { durationMinutes, reason }
    );
    return response.data;
  },

  cancelSnooze: async (id: string): Promise<{ incident: Incident; message: string }> => {
    const response = await apiClient.delete<{ incident: Incident; message: string }>(
      `/incidents/${id}/snooze`
    );
    return response.data;
  },

  escalate: async (id: string, reason?: string): Promise<{ incident: Incident; message: string }> => {
    const response = await apiClient.post<{ incident: Incident; message: string }>(
      `/incidents/${id}/escalate`,
      { reason }
    );
    return response.data;
  },

  reassign: async (id: string, assignToUserId: string, reason?: string): Promise<{ incident: Incident; message: string }> => {
    const response = await apiClient.put<{ incident: Incident; message: string }>(
      `/incidents/${id}/reassign`,
      { assignToUserId, reason }
    );
    return response.data;
  },

  delete: async (id: string): Promise<{ message: string; deleted: { id: string; incidentNumber: number; summary: string } }> => {
    const response = await apiClient.delete<{ message: string; deleted: { id: string; incidentNumber: number; summary: string } }>(
      `/incidents/${id}`
    );
    return response.data;
  },
};

// Users API
export const usersAPI = {
  getMe: async (): Promise<{ user: User }> => {
    const response = await apiClient.get<{ user: User }>('/users/me');
    return response.data;
  },

  getMyAvailability: async (): Promise<{ availability: UserAvailability | null; hasAvailability: boolean }> => {
    const response = await apiClient.get<{ availability: UserAvailability | null; hasAvailability: boolean }>(
      '/users/me/availability'
    );
    return response.data;
  },

  updateMyAvailability: async (data: UserAvailability): Promise<{ availability: UserAvailability }> => {
    const response = await apiClient.put<{ availability: UserAvailability }>(
      '/users/me/availability',
      data
    );
    return response.data;
  },

  listUsers: async (hasAvailability?: boolean): Promise<{ users: User[] }> => {
    const params = hasAvailability !== undefined ? { hasAvailability } : {};
    const response = await apiClient.get<{ users: User[] }>('/users', { params });
    return response.data;
  },

  updateProfile: async (data: UpdateProfileRequest): Promise<UpdateProfileResponse> => {
    const response = await apiClient.put<UpdateProfileResponse>('/users/me', data);
    return response.data;
  },

  // Admin: List all users (including inactive)
  listAllUsers: async (): Promise<{ users: User[] }> => {
    const response = await apiClient.get<{ users: User[] }>('/users', {
      params: { includeInactive: true },
    });
    return response.data;
  },

  // Admin: Invite a new user
  inviteUser: async (data: InviteUserRequest): Promise<{ message: string; user: User }> => {
    const response = await apiClient.post<{ message: string; user: User }>('/users/invite', data);
    return response.data;
  },

  // Admin: Update user role
  updateUserRole: async (userId: string, role: 'admin' | 'member'): Promise<{ message: string; user: User }> => {
    const response = await apiClient.put<{ message: string; user: User }>(`/users/${userId}/role`, { role });
    return response.data;
  },

  // Admin: Update user status
  updateUserStatus: async (userId: string, status: 'active' | 'inactive'): Promise<{ message: string; user: User }> => {
    const response = await apiClient.put<{ message: string; user: User }>(`/users/${userId}/status`, { status });
    return response.data;
  },
};

// AI Credentials API
export interface AnthropicCredentialStatus {
  configured: boolean;
  type?: 'api_key' | 'oauth';
  hint?: string;
  hasRefreshToken?: boolean;
  updatedAt?: string;
  message?: string;
}

export interface SaveCredentialResponse {
  message: string;
  credential: {
    type: 'api_key' | 'oauth';
    hint: string;
    hasRefreshToken: boolean;
    updatedAt: string;
  };
}

export const aiCredentialsAPI = {
  getStatus: async (): Promise<AnthropicCredentialStatus> => {
    const response = await apiClient.get<AnthropicCredentialStatus>('/users/me/anthropic-credentials');
    return response.data;
  },

  save: async (credential: string, refreshToken?: string): Promise<SaveCredentialResponse> => {
    const response = await apiClient.post<SaveCredentialResponse>('/users/me/anthropic-credentials', {
      credential,
      refreshToken,
    });
    return response.data;
  },

  remove: async (): Promise<{ message: string }> => {
    const response = await apiClient.delete<{ message: string }>('/users/me/anthropic-credentials');
    return response.data;
  },
};

// Services API
export const servicesAPI = {
  list: async (): Promise<{ services: Service[] }> => {
    const response = await apiClient.get<{ services: Service[] }>('/services');
    return response.data;
  },

  get: async (id: string): Promise<{ service: Service }> => {
    const response = await apiClient.get<{ service: Service }>(`/services/${id}`);
    return response.data;
  },

  create: async (data: CreateServiceRequest): Promise<{ service: Service; message: string }> => {
    const response = await apiClient.post<{ service: Service; message: string }>('/services', data);
    return response.data;
  },

  update: async (id: string, data: UpdateServiceRequest): Promise<{ service: Service; message: string }> => {
    const response = await apiClient.put<{ service: Service; message: string }>(`/services/${id}`, data);
    return response.data;
  },

  regenerateApiKey: async (id: string): Promise<{ service: Service; message: string }> => {
    const response = await apiClient.post<{ service: Service; message: string }>(`/services/${id}/regenerate-key`);
    return response.data;
  },

  delete: async (id: string): Promise<{ message: string }> => {
    const response = await apiClient.delete<{ message: string }>(`/services/${id}`);
    return response.data;
  },
};

// Setup Wizard API
export interface SetupServiceRequest {
  templateId: string;
  name: string;
  description: string;
  runbook: {
    title: string;
    description: string;
    steps: Array<{
      id: string;
      order: number;
      title: string;
      description: string;
      isOptional: boolean;
      estimatedMinutes: number;
      action: {
        type: 'webhook';
        label: string;
        url: string;
        method: string;
        body?: Record<string, unknown>;
        confirmMessage?: string;
      };
    }>;
  };
}

export interface SetupCompleteRequest {
  aiApiKey?: string;
  services: SetupServiceRequest[];
  teamEmails: string[];
  createRotation: boolean;
}

export interface SetupCompleteResponse {
  message: string;
  created: {
    services: number;
    runbooks: number;
    invitations: number;
    schedule?: string;
  };
}

export const setupAPI = {
  complete: async (data: SetupCompleteRequest): Promise<SetupCompleteResponse> => {
    const response = await apiClient.post<SetupCompleteResponse>('/setup/complete', data);
    return response.data;
  },

  getStatus: async (): Promise<{ setupCompleted: boolean; completedAt?: string }> => {
    const response = await apiClient.get<{ setupCompleted: boolean; completedAt?: string }>('/setup/status');
    return response.data;
  },
};

// Runbooks API
export const runbooksAPI = {
  list: async (): Promise<{ runbooks: Runbook[] }> => {
    const response = await apiClient.get<{ runbooks: Runbook[] }>('/runbooks');
    return response.data;
  },

  listForService: async (serviceId: string): Promise<{ runbooks: Runbook[] }> => {
    const response = await apiClient.get<{ runbooks: Runbook[] }>(`/runbooks/service/${serviceId}`);
    return response.data;
  },

  get: async (id: string): Promise<{ runbook: Runbook }> => {
    const response = await apiClient.get<{ runbook: Runbook }>(`/runbooks/${id}`);
    return response.data;
  },

  create: async (data: CreateRunbookRequest): Promise<{ runbook: Runbook; message: string }> => {
    const response = await apiClient.post<{ runbook: Runbook; message: string }>('/runbooks', data);
    return response.data;
  },

  update: async (id: string, data: UpdateRunbookRequest): Promise<{ runbook: Runbook; message: string }> => {
    const response = await apiClient.put<{ runbook: Runbook; message: string }>(`/runbooks/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<{ message: string }> => {
    const response = await apiClient.delete<{ message: string }>(`/runbooks/${id}`);
    return response.data;
  },
};

export default apiClient;
