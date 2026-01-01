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
  ScheduleOverride,
  CreateScheduleOverrideRequest,
  UpdateScheduleOverrideRequest,
  ScheduleLayer,
  ScheduleLayerMember,
  CreateScheduleLayerRequest,
  UpdateScheduleLayerRequest,
  RenderedScheduleResponse,
  MaintenanceWindow,
  CreateMaintenanceWindowRequest,
  UpdateMaintenanceWindowRequest,
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
  UserContactMethod,
  CreateContactMethodRequest,
  UpdateContactMethodRequest,
  UserNotificationRule,
  CreateNotificationRuleRequest,
  UpdateNotificationRuleRequest,
  AlertRoutingRule,
  CreateRoutingRuleRequest,
  UpdateRoutingRuleRequest,
  RoutingRuleTestResult,
  AlertGroupingRule,
  UpdateGroupingRuleRequest,
  PriorityLevel,
  CreatePriorityRequest,
  UpdatePriorityRequest,
  BusinessService,
  CreateBusinessServiceRequest,
  UpdateBusinessServiceRequest,
  ServiceDependency,
  CreateDependencyRequest,
  UpdateDependencyRequest,
  ServiceDependencies,
  DependencyGraph,
  EventTransformRule,
  CreateEventTransformRuleRequest,
  UpdateEventTransformRuleRequest,
  EventTransformTestResult,
  Tag,
  CreateTagRequest,
  UpdateTagRequest,
  BulkCreateTagRequest,
  EntityType,
  TagEntitiesResponse,
  Postmortem,
  PostmortemTemplate,
  CreatePostmortemRequest,
  UpdatePostmortemRequest,
  CreatePostmortemTemplateRequest,
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

  // Schedule Overrides (new table-based)
  listOverrides: async (scheduleId: string): Promise<{ overrides: ScheduleOverride[] }> => {
    const response = await apiClient.get<{ overrides: ScheduleOverride[] }>(
      `/schedules/${scheduleId}/overrides`
    );
    return response.data;
  },

  getOverride: async (scheduleId: string, overrideId: string): Promise<{ override: ScheduleOverride }> => {
    const response = await apiClient.get<{ override: ScheduleOverride }>(
      `/schedules/${scheduleId}/overrides/${overrideId}`
    );
    return response.data;
  },

  createOverrideNew: async (
    scheduleId: string,
    data: CreateScheduleOverrideRequest
  ): Promise<{ override: ScheduleOverride; message: string }> => {
    const response = await apiClient.post<{ override: ScheduleOverride; message: string }>(
      `/schedules/${scheduleId}/overrides`,
      data
    );
    return response.data;
  },

  updateOverride: async (
    scheduleId: string,
    overrideId: string,
    data: UpdateScheduleOverrideRequest
  ): Promise<{ override: ScheduleOverride; message: string }> => {
    const response = await apiClient.put<{ override: ScheduleOverride; message: string }>(
      `/schedules/${scheduleId}/overrides/${overrideId}`,
      data
    );
    return response.data;
  },

  deleteOverride: async (scheduleId: string, overrideId: string): Promise<{ message: string }> => {
    const response = await apiClient.delete<{ message: string }>(
      `/schedules/${scheduleId}/overrides/${overrideId}`
    );
    return response.data;
  },

  // Schedule Layers
  listLayers: async (scheduleId: string): Promise<{ schedule: { id: string; name: string }; layers: ScheduleLayer[] }> => {
    const response = await apiClient.get<{ schedule: { id: string; name: string }; layers: ScheduleLayer[] }>(
      `/schedules/${scheduleId}/layers`
    );
    return response.data;
  },

  createLayer: async (
    scheduleId: string,
    data: CreateScheduleLayerRequest
  ): Promise<{ layer: ScheduleLayer; message: string }> => {
    const response = await apiClient.post<{ layer: ScheduleLayer; message: string }>(
      `/schedules/${scheduleId}/layers`,
      data
    );
    return response.data;
  },

  updateLayer: async (
    scheduleId: string,
    layerId: string,
    data: UpdateScheduleLayerRequest
  ): Promise<{ layer: ScheduleLayer; message: string }> => {
    const response = await apiClient.put<{ layer: ScheduleLayer; message: string }>(
      `/schedules/${scheduleId}/layers/${layerId}`,
      data
    );
    return response.data;
  },

  deleteLayer: async (scheduleId: string, layerId: string): Promise<{ message: string }> => {
    const response = await apiClient.delete<{ message: string }>(
      `/schedules/${scheduleId}/layers/${layerId}`
    );
    return response.data;
  },

  updateLayerMembers: async (
    scheduleId: string,
    layerId: string,
    userIds: string[]
  ): Promise<{ members: ScheduleLayerMember[]; currentOncallUserId: string | null }> => {
    const response = await apiClient.put<{ members: ScheduleLayerMember[]; currentOncallUserId: string | null }>(
      `/schedules/${scheduleId}/layers/${layerId}/members`,
      { userIds }
    );
    return response.data;
  },

  getRenderedSchedule: async (
    scheduleId: string,
    since?: string,
    until?: string
  ): Promise<RenderedScheduleResponse> => {
    const params: Record<string, string> = {};
    if (since) params.since = since;
    if (until) params.until = until;
    const response = await apiClient.get<RenderedScheduleResponse>(
      `/schedules/${scheduleId}/rendered`,
      { params }
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

  get: async (id: string): Promise<IncidentDetailResponse> => {
    const response = await apiClient.get<IncidentDetailResponse>(`/incidents/${id}`);
    return response.data;
  },

  getTimeline: async (id: string): Promise<IncidentTimelineResponse> => {
    const response = await apiClient.get<IncidentTimelineResponse>(`/incidents/${id}/timeline`);
    return response.data;
  },

  getNotifications: async (id: string): Promise<{
    notifications: Array<{
      userId: string;
      userName: string;
      userEmail: string;
      channels: Array<{
        channel: string;
        status: string;
        sentAt: string | null;
        deliveredAt: string | null;
        failedAt: string | null;
        errorMessage: string | null;
      }>;
    }>;
    summary: {
      total: number;
      pending: number;
      sent: number;
      delivered: number;
      failed: number;
    };
  }> => {
    const response = await apiClient.get(`/incidents/${id}/notifications`);
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

  getSimilar: async (id: string): Promise<{
    currentIncidentId: string;
    bestMatch: SimilarIncident | null;
    similarIncidents: SimilarIncident[];
    total: number;
  }> => {
    const response = await apiClient.get(`/incidents/${id}/similar`);
    return response.data;
  },

  // Snooze
  snooze: async (id: string, duration: number): Promise<{ incident: Incident; message: string }> => {
    const response = await apiClient.post<{ incident: Incident; message: string }>(
      `/incidents/${id}/snooze`,
      { duration }
    );
    return response.data;
  },

  unsnooze: async (id: string): Promise<{ incident: Incident; message: string }> => {
    const response = await apiClient.delete<{ incident: Incident; message: string }>(
      `/incidents/${id}/snooze`
    );
    return response.data;
  },

  // Postmortem
  getPostmortem: async (id: string): Promise<{ postmortem: any }> => {
    const response = await apiClient.get<{ postmortem: any }>(
      `/incidents/${id}/postmortem`
    );
    return response.data;
  },

  createPostmortem: async (id: string, title?: string): Promise<{ postmortem: any; message: string }> => {
    const response = await apiClient.post<{ postmortem: any; message: string }>(
      `/incidents/${id}/postmortem`,
      title ? { title } : {}
    );
    return response.data;
  },

  // Responders
  getResponders: async (id: string): Promise<{
    responders: Array<{
      id: string;
      userId: string;
      user: { id: string; fullName: string; email: string };
      requestedBy: { id: string; fullName: string; email: string };
      status: 'pending' | 'accepted' | 'declined';
      message: string | null;
      respondedAt: string | null;
      createdAt: string;
    }>;
  }> => {
    const response = await apiClient.get(`/incidents/${id}/responders`);
    return response.data;
  },

  addResponders: async (id: string, userIds: string[], message?: string): Promise<{
    responders: Array<{
      id: string;
      userId: string;
      status: string;
    }>;
    message: string;
  }> => {
    const response = await apiClient.post(`/incidents/${id}/responders`, { userIds, message });
    return response.data;
  },

  respondToRequest: async (incidentId: string, responderId: string, accept: boolean): Promise<{
    responder: { id: string; status: string };
    message: string;
  }> => {
    const response = await apiClient.put(`/incidents/${incidentId}/responders/${responderId}`, { accept });
    return response.data;
  },

  // Conference Bridge
  getConferenceBridge: async (id: string): Promise<{
    bridge: ConferenceBridge | null;
  }> => {
    const response = await apiClient.get(`/incidents/${id}/conference-bridge`);
    return response.data;
  },

  createConferenceBridge: async (id: string, data: {
    provider: 'zoom' | 'google_meet' | 'microsoft_teams' | 'manual';
    meetingUrl?: string;
    passcode?: string;
    dialInNumber?: string;
  }): Promise<{
    bridge: ConferenceBridge;
    message: string;
  }> => {
    const response = await apiClient.post(`/incidents/${id}/conference-bridge`, data);
    return response.data;
  },

  endConferenceBridge: async (incidentId: string, bridgeId: string): Promise<{
    message: string;
  }> => {
    const response = await apiClient.put(`/incidents/${incidentId}/conference-bridge/${bridgeId}/end`);
    return response.data;
  },

  getConferenceBridgeProviders: async (): Promise<{
    providers: Array<{
      id: string;
      name: string;
      configured: boolean;
      description: string;
    }>;
  }> => {
    const response = await apiClient.get('/conference-bridge/providers');
    return response.data;
  },
};

// Conference Bridge type
export interface ConferenceBridge {
  id: string;
  provider: 'zoom' | 'google_meet' | 'microsoft_teams' | 'manual';
  providerLabel: string;
  status: 'creating' | 'active' | 'ended' | 'failed';
  meetingUrl: string;
  meetingId?: string;
  passcode?: string;
  dialInNumber?: string;
  dialInPin?: string;
  participantCount: number;
  createdBy?: {
    id: string;
    fullName: string;
  };
  startedAt?: string;
  endedAt?: string;
  createdAt: string;
}

// Similar Incident type for the similar incidents endpoint
export interface SimilarIncident {
  id: string;
  incidentNumber: number;
  summary: string;
  severity: string;
  state: string;
  triggeredAt: string;
  resolvedAt?: string;
  resolvedBy?: {
    id: string;
    fullName: string;
  };
  similarityPercent: number;
  matchingKeywords: string[];
  resolutionNote?: string;
}

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

  // Contact Methods
  listContactMethods: async (): Promise<{ contactMethods: UserContactMethod[] }> => {
    const response = await apiClient.get<{ contactMethods: UserContactMethod[] }>('/users/me/contact-methods');
    return response.data;
  },

  createContactMethod: async (data: CreateContactMethodRequest): Promise<{ contactMethod: UserContactMethod; message: string }> => {
    const response = await apiClient.post<{ contactMethod: UserContactMethod; message: string }>('/users/me/contact-methods', data);
    return response.data;
  },

  updateContactMethod: async (id: string, data: UpdateContactMethodRequest): Promise<{ contactMethod: UserContactMethod; message: string }> => {
    const response = await apiClient.put<{ contactMethod: UserContactMethod; message: string }>(`/users/me/contact-methods/${id}`, data);
    return response.data;
  },

  deleteContactMethod: async (id: string): Promise<{ message: string }> => {
    const response = await apiClient.delete<{ message: string }>(`/users/me/contact-methods/${id}`);
    return response.data;
  },

  verifyContactMethod: async (id: string, code?: string): Promise<{ message: string; verified?: boolean; sentAt?: string }> => {
    const response = await apiClient.post<{ message: string; verified?: boolean; sentAt?: string }>(
      `/users/me/contact-methods/${id}/verify`,
      code ? { code } : {}
    );
    return response.data;
  },

  // Notification Rules
  listNotificationRules: async (): Promise<{ notificationRules: UserNotificationRule[] }> => {
    const response = await apiClient.get<{ notificationRules: UserNotificationRule[] }>('/users/me/notification-rules');
    return response.data;
  },

  createNotificationRule: async (data: CreateNotificationRuleRequest): Promise<{ notificationRule: UserNotificationRule; message: string }> => {
    const response = await apiClient.post<{ notificationRule: UserNotificationRule; message: string }>('/users/me/notification-rules', data);
    return response.data;
  },

  updateNotificationRule: async (id: string, data: UpdateNotificationRuleRequest): Promise<{ notificationRule: UserNotificationRule; message: string }> => {
    const response = await apiClient.put<{ notificationRule: UserNotificationRule; message: string }>(`/users/me/notification-rules/${id}`, data);
    return response.data;
  },

  deleteNotificationRule: async (id: string): Promise<{ message: string }> => {
    const response = await apiClient.delete<{ message: string }>(`/users/me/notification-rules/${id}`);
    return response.data;
  },

  // Profile Picture
  getProfilePictureUploadUrl: async (contentType: string): Promise<{ uploadUrl: string; publicUrl: string }> => {
    const response = await apiClient.post<{ uploadUrl: string; publicUrl: string }>(
      '/users/me/profile-picture/upload-url',
      { contentType }
    );
    return response.data;
  },

  uploadToPresignedUrl: async (uploadUrl: string, file: Blob, contentType: string): Promise<void> => {
    await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      body: file,
    });
  },

  updateProfilePicture: async (profilePictureUrl: string): Promise<{ user: User; message: string }> => {
    const response = await apiClient.put<{ user: User; message: string }>(
      '/users/me/profile-picture',
      { profilePictureUrl }
    );
    return response.data;
  },

  removeProfilePicture: async (): Promise<{ message: string }> => {
    const response = await apiClient.delete<{ message: string }>('/users/me/profile-picture');
    return response.data;
  },

  // Do Not Disturb (DND) Settings
  getDNDSettings: async (): Promise<{ dnd: DNDSettings }> => {
    const response = await apiClient.get<{ dnd: DNDSettings }>('/users/me/dnd');
    return response.data;
  },

  updateDNDSettings: async (data: UpdateDNDRequest): Promise<{ dnd: DNDSettings; message: string }> => {
    const response = await apiClient.put<{ dnd: DNDSettings; message: string }>('/users/me/dnd', data);
    return response.data;
  },
};

// DND Settings types
export interface DNDSettings {
  enabled: boolean;
  startTime: string | null;
  endTime: string | null;
  timezone: string | null;
}

export interface UpdateDNDRequest {
  enabled: boolean;
  startTime?: string | null;
  endTime?: string | null;
  timezone?: string | null;
}

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

  // Maintenance Windows
  listMaintenanceWindows: async (
    serviceId: string,
    status?: 'active' | 'upcoming' | 'past'
  ): Promise<{ maintenanceWindows: MaintenanceWindow[] }> => {
    const params = status ? { status } : {};
    const response = await apiClient.get<{ maintenanceWindows: MaintenanceWindow[] }>(
      `/services/${serviceId}/maintenance-windows`,
      { params }
    );
    return response.data;
  },

  getMaintenanceWindow: async (
    serviceId: string,
    windowId: string
  ): Promise<{ maintenanceWindow: MaintenanceWindow }> => {
    const response = await apiClient.get<{ maintenanceWindow: MaintenanceWindow }>(
      `/services/${serviceId}/maintenance-windows/${windowId}`
    );
    return response.data;
  },

  createMaintenanceWindow: async (
    serviceId: string,
    data: CreateMaintenanceWindowRequest
  ): Promise<{ maintenanceWindow: MaintenanceWindow; message: string }> => {
    const response = await apiClient.post<{ maintenanceWindow: MaintenanceWindow; message: string }>(
      `/services/${serviceId}/maintenance-windows`,
      data
    );
    return response.data;
  },

  updateMaintenanceWindow: async (
    serviceId: string,
    windowId: string,
    data: UpdateMaintenanceWindowRequest
  ): Promise<{ maintenanceWindow: MaintenanceWindow; message: string }> => {
    const response = await apiClient.put<{ maintenanceWindow: MaintenanceWindow; message: string }>(
      `/services/${serviceId}/maintenance-windows/${windowId}`,
      data
    );
    return response.data;
  },

  deleteMaintenanceWindow: async (
    serviceId: string,
    windowId: string
  ): Promise<{ message: string }> => {
    const response = await apiClient.delete<{ message: string }>(
      `/services/${serviceId}/maintenance-windows/${windowId}`
    );
    return response.data;
  },

  getActiveMaintenanceWindows: async (): Promise<{ maintenanceWindows: MaintenanceWindow[] }> => {
    const response = await apiClient.get<{ maintenanceWindows: MaintenanceWindow[] }>(
      '/services/maintenance-windows/active'
    );
    return response.data;
  },

  // Alert Grouping Rules
  getGroupingRule: async (serviceId: string): Promise<{
    groupingRule: AlertGroupingRule | null;
    defaults?: {
      groupingType: string;
      timeWindowMinutes: number;
      contentFields: string[];
      maxAlertsPerIncident: number;
    };
  }> => {
    const response = await apiClient.get<{
      groupingRule: AlertGroupingRule | null;
      defaults?: {
        groupingType: string;
        timeWindowMinutes: number;
        contentFields: string[];
        maxAlertsPerIncident: number;
      };
    }>(`/services/${serviceId}/grouping-rule`);
    return response.data;
  },

  updateGroupingRule: async (
    serviceId: string,
    data: UpdateGroupingRuleRequest
  ): Promise<{ groupingRule: AlertGroupingRule; message: string }> => {
    const response = await apiClient.put<{ groupingRule: AlertGroupingRule; message: string }>(
      `/services/${serviceId}/grouping-rule`,
      data
    );
    return response.data;
  },

  deleteGroupingRule: async (serviceId: string): Promise<{ message: string }> => {
    const response = await apiClient.delete<{ message: string }>(
      `/services/${serviceId}/grouping-rule`
    );
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

// Integrations API
export interface Integration {
  id: string;
  type: 'slack' | 'teams' | 'jira' | 'servicenow' | 'webhook' | 'pagerduty_import';
  name: string;
  status: 'pending' | 'active' | 'error' | 'disabled';
  config: Record<string, any>;
  features: Record<string, boolean>;
  slackWorkspaceId?: string;
  slackWorkspaceName?: string;
  slackDefaultChannelId?: string;
  jiraSiteUrl?: string;
  jiraProjectKey?: string;
  jiraIssueType?: string;
  webhookUrl?: string;
  lastError?: string;
  lastErrorAt?: string;
  errorCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface IntegrationEvent {
  id: string;
  eventType: string;
  direction: 'inbound' | 'outbound';
  status: 'success' | 'failed' | 'pending' | 'retrying';
  errorMessage?: string;
  incidentId?: string;
  externalId?: string;
  externalUrl?: string;
  createdAt: string;
}

export interface SlackChannel {
  id: string;
  name: string;
}

export const integrationsAPI = {
  list: async (type?: string): Promise<{ integrations: Integration[] }> => {
    const params = type ? { type } : {};
    const response = await apiClient.get<{ integrations: Integration[] }>('/integrations', { params });
    return response.data;
  },

  get: async (id: string): Promise<{ integration: Integration }> => {
    const response = await apiClient.get<{ integration: Integration }>(`/integrations/${id}`);
    return response.data;
  },

  create: async (data: {
    type: Integration['type'];
    name: string;
    config?: Record<string, any>;
    features?: Record<string, boolean>;
  }): Promise<{ integration: Integration; message: string }> => {
    const response = await apiClient.post<{ integration: Integration; message: string }>('/integrations', data);
    return response.data;
  },

  update: async (id: string, data: {
    name?: string;
    config?: Record<string, any>;
    features?: Record<string, boolean>;
    status?: 'active' | 'disabled';
  }): Promise<{ integration: Integration; message: string }> => {
    const response = await apiClient.put<{ integration: Integration; message: string }>(`/integrations/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<{ message: string }> => {
    const response = await apiClient.delete<{ message: string }>(`/integrations/${id}`);
    return response.data;
  },

  getEvents: async (id: string, limit?: number): Promise<{ events: IntegrationEvent[] }> => {
    const params = limit ? { limit } : {};
    const response = await apiClient.get<{ events: IntegrationEvent[] }>(`/integrations/${id}/events`, { params });
    return response.data;
  },

  // Slack-specific
  getSlackOAuthUrl: async (id: string, redirectUri: string): Promise<{ oauthUrl: string }> => {
    const response = await apiClient.get<{ oauthUrl: string }>(`/integrations/${id}/slack/oauth-url`, {
      params: { redirect_uri: redirectUri },
    });
    return response.data;
  },

  completeSlackOAuth: async (id: string, code: string, redirectUri: string): Promise<{ integration: Integration; message: string }> => {
    const response = await apiClient.post<{ integration: Integration; message: string }>(`/integrations/${id}/slack/oauth-callback`, {
      code,
      redirect_uri: redirectUri,
    });
    return response.data;
  },

  listSlackChannels: async (id: string): Promise<{ channels: SlackChannel[] }> => {
    const response = await apiClient.get<{ channels: SlackChannel[] }>(`/integrations/${id}/slack/channels`);
    return response.data;
  },

  testSlack: async (id: string, channelId: string): Promise<{ message: string; messageTs?: string }> => {
    const response = await apiClient.post<{ message: string; messageTs?: string }>(`/integrations/${id}/slack/test`, {
      channel_id: channelId,
    });
    return response.data;
  },

  // Service linking
  getLinkedServices: async (id: string): Promise<{ services: { id: string; name: string; status: string }[] }> => {
    const response = await apiClient.get<{ services: { id: string; name: string; status: string }[] }>(`/integrations/${id}/services`);
    return response.data;
  },

  linkService: async (integrationId: string, serviceId: string, configOverrides?: Record<string, any>): Promise<{ message: string }> => {
    const response = await apiClient.post<{ message: string }>(`/integrations/${integrationId}/services/${serviceId}`, {
      config_overrides: configOverrides,
    });
    return response.data;
  },

  unlinkService: async (integrationId: string, serviceId: string): Promise<{ message: string }> => {
    const response = await apiClient.delete<{ message: string }>(`/integrations/${integrationId}/services/${serviceId}`);
    return response.data;
  },
};

// Teams API
export interface Team {
  id: string;
  name: string;
  description: string | null;
  slug: string | null;
  memberCount: number;
  members?: TeamMember[];
  resources?: {
    schedules: { id: string; name: string }[];
    escalationPolicies: { id: string; name: string }[];
    services: { id: string; name: string }[];
  };
  createdAt: string;
  updatedAt: string;
}

export interface TeamMember {
  id: string;
  userId: string;
  role: 'manager' | 'member';
  user: {
    id: string;
    fullName: string;
    email: string;
  } | null;
  createdAt: string;
}

export interface CreateTeamRequest {
  name: string;
  description?: string;
  slug?: string;
}

export interface UpdateTeamRequest {
  name?: string;
  description?: string;
  slug?: string;
  settings?: Record<string, any>;
}

export const teamsAPI = {
  list: async (): Promise<{ teams: Team[] }> => {
    const response = await apiClient.get<{ teams: Team[] }>('/teams');
    return response.data;
  },

  get: async (id: string): Promise<{ team: Team }> => {
    const response = await apiClient.get<{ team: Team }>(`/teams/${id}`);
    return response.data;
  },

  create: async (data: CreateTeamRequest): Promise<{ team: Team; message: string }> => {
    const response = await apiClient.post<{ team: Team; message: string }>('/teams', data);
    return response.data;
  },

  update: async (id: string, data: UpdateTeamRequest): Promise<{ team: Team; message: string }> => {
    const response = await apiClient.put<{ team: Team; message: string }>(`/teams/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<{ message: string }> => {
    const response = await apiClient.delete<{ message: string }>(`/teams/${id}`);
    return response.data;
  },

  // Members
  getMembers: async (id: string): Promise<{ teamId: string; teamName: string; members: TeamMember[] }> => {
    const response = await apiClient.get<{ teamId: string; teamName: string; members: TeamMember[] }>(`/teams/${id}/members`);
    return response.data;
  },

  addMember: async (teamId: string, userId: string, role: 'manager' | 'member' = 'member'): Promise<{ member: TeamMember; message: string }> => {
    const response = await apiClient.post<{ member: TeamMember; message: string }>(`/teams/${teamId}/members`, { userId, role });
    return response.data;
  },

  updateMemberRole: async (teamId: string, userId: string, role: 'manager' | 'member'): Promise<{ member: TeamMember; message: string }> => {
    const response = await apiClient.put<{ member: TeamMember; message: string }>(`/teams/${teamId}/members/${userId}`, { role });
    return response.data;
  },

  removeMember: async (teamId: string, userId: string): Promise<{ message: string }> => {
    const response = await apiClient.delete<{ message: string }>(`/teams/${teamId}/members/${userId}`);
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

// Routing Rules API
export const routingRulesAPI = {
  list: async (): Promise<{ rules: AlertRoutingRule[] }> => {
    const response = await apiClient.get<{ rules: AlertRoutingRule[] }>('/routing-rules');
    return response.data;
  },

  get: async (id: string): Promise<{ rule: AlertRoutingRule }> => {
    const response = await apiClient.get<{ rule: AlertRoutingRule }>(`/routing-rules/${id}`);
    return response.data;
  },

  create: async (data: CreateRoutingRuleRequest): Promise<{ rule: AlertRoutingRule; message: string }> => {
    const response = await apiClient.post<{ rule: AlertRoutingRule; message: string }>('/routing-rules', data);
    return response.data;
  },

  update: async (id: string, data: UpdateRoutingRuleRequest): Promise<{ rule: AlertRoutingRule; message: string }> => {
    const response = await apiClient.put<{ rule: AlertRoutingRule; message: string }>(`/routing-rules/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<{ message: string }> => {
    const response = await apiClient.delete<{ message: string }>(`/routing-rules/${id}`);
    return response.data;
  },

  reorder: async (ruleIds: string[]): Promise<{ message: string }> => {
    const response = await apiClient.put<{ message: string }>('/routing-rules/reorder', { ruleIds });
    return response.data;
  },

  test: async (id: string, payload: Record<string, any>): Promise<RoutingRuleTestResult> => {
    const response = await apiClient.post<RoutingRuleTestResult>(`/routing-rules/${id}/test`, { payload });
    return response.data;
  },
};

// Priorities API
export const prioritiesAPI = {
  list: async (): Promise<{ priorities: PriorityLevel[] }> => {
    const response = await apiClient.get<{ priorities: PriorityLevel[] }>('/priorities');
    return response.data;
  },

  get: async (id: string): Promise<{ priority: PriorityLevel }> => {
    const response = await apiClient.get<{ priority: PriorityLevel }>(`/priorities/${id}`);
    return response.data;
  },

  create: async (data: CreatePriorityRequest): Promise<{ priority: PriorityLevel; message: string }> => {
    const response = await apiClient.post<{ priority: PriorityLevel; message: string }>('/priorities', data);
    return response.data;
  },

  update: async (id: string, data: UpdatePriorityRequest): Promise<{ priority: PriorityLevel; message: string }> => {
    const response = await apiClient.put<{ priority: PriorityLevel; message: string }>(`/priorities/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<{ message: string }> => {
    const response = await apiClient.delete<{ message: string }>(`/priorities/${id}`);
    return response.data;
  },

  reorder: async (priorityIds: string[]): Promise<{ message: string }> => {
    const response = await apiClient.put<{ message: string }>('/priorities/reorder', { priorityIds });
    return response.data;
  },

  seedDefaults: async (): Promise<{ priorities: PriorityLevel[]; message: string }> => {
    const response = await apiClient.post<{ priorities: PriorityLevel[]; message: string }>('/priorities/seed-defaults');
    return response.data;
  },
};

// Business Services API
export const businessServicesAPI = {
  list: async (params?: {
    status?: string;
    impactTier?: string;
    teamId?: string;
  }): Promise<BusinessService[]> => {
    const response = await apiClient.get<BusinessService[]>('/business-services', { params });
    return response.data;
  },

  get: async (id: string): Promise<BusinessService> => {
    const response = await apiClient.get<BusinessService>(`/business-services/${id}`);
    return response.data;
  },

  create: async (data: CreateBusinessServiceRequest): Promise<BusinessService> => {
    const response = await apiClient.post<BusinessService>('/business-services', data);
    return response.data;
  },

  update: async (id: string, data: UpdateBusinessServiceRequest): Promise<BusinessService> => {
    const response = await apiClient.put<BusinessService>(`/business-services/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/business-services/${id}`);
  },

  updateServices: async (id: string, serviceIds: string[]): Promise<BusinessService> => {
    const response = await apiClient.put<BusinessService>(`/business-services/${id}/services`, { serviceIds });
    return response.data;
  },

  // Dependency Graph
  getDependencyGraph: async (): Promise<DependencyGraph> => {
    const response = await apiClient.get<DependencyGraph>('/business-services/dependency-graph');
    return response.data;
  },
};

// Service Dependencies API
export const dependenciesAPI = {
  getForService: async (
    serviceId: string,
    direction: 'upstream' | 'downstream' | 'both' = 'both'
  ): Promise<ServiceDependencies> => {
    const response = await apiClient.get<ServiceDependencies>(
      `/business-services/services/${serviceId}/dependencies`,
      { params: { direction } }
    );
    return response.data;
  },

  create: async (data: CreateDependencyRequest): Promise<ServiceDependency> => {
    const response = await apiClient.post<ServiceDependency>('/business-services/dependencies', data);
    return response.data;
  },

  update: async (id: string, data: UpdateDependencyRequest): Promise<ServiceDependency> => {
    const response = await apiClient.put<ServiceDependency>(`/business-services/dependencies/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/business-services/dependencies/${id}`);
  },
};

// Event Transform Rules API
export const eventTransformRulesAPI = {
  listForService: async (serviceId: string): Promise<{ rules: EventTransformRule[] }> => {
    const response = await apiClient.get<{ rules: EventTransformRule[] }>(
      `/services/${serviceId}/event-rules`
    );
    return response.data;
  },

  get: async (serviceId: string, ruleId: string): Promise<{ rule: EventTransformRule }> => {
    const response = await apiClient.get<{ rule: EventTransformRule }>(
      `/services/${serviceId}/event-rules/${ruleId}`
    );
    return response.data;
  },

  create: async (
    serviceId: string,
    data: CreateEventTransformRuleRequest
  ): Promise<{ rule: EventTransformRule; message: string }> => {
    const response = await apiClient.post<{ rule: EventTransformRule; message: string }>(
      `/services/${serviceId}/event-rules`,
      data
    );
    return response.data;
  },

  update: async (
    serviceId: string,
    ruleId: string,
    data: UpdateEventTransformRuleRequest
  ): Promise<{ rule: EventTransformRule; message: string }> => {
    const response = await apiClient.put<{ rule: EventTransformRule; message: string }>(
      `/services/${serviceId}/event-rules/${ruleId}`,
      data
    );
    return response.data;
  },

  delete: async (serviceId: string, ruleId: string): Promise<{ message: string }> => {
    const response = await apiClient.delete<{ message: string }>(
      `/services/${serviceId}/event-rules/${ruleId}`
    );
    return response.data;
  },

  reorder: async (serviceId: string, ruleIds: string[]): Promise<{ message: string }> => {
    const response = await apiClient.put<{ message: string }>(
      `/services/${serviceId}/event-rules/reorder`,
      { ruleIds }
    );
    return response.data;
  },

  test: async (
    serviceId: string,
    ruleId: string,
    payload: Record<string, any>
  ): Promise<EventTransformTestResult> => {
    const response = await apiClient.post<EventTransformTestResult>(
      `/services/${serviceId}/event-rules/${ruleId}/test`,
      { payload }
    );
    return response.data;
  },
};

// Tags API
export const tagsAPI = {
  list: async (params?: { search?: string }): Promise<{ tags: Tag[] }> => {
    const response = await apiClient.get<{ tags: Tag[] }>('/tags', { params });
    return response.data;
  },

  get: async (id: string): Promise<{ tag: Tag }> => {
    const response = await apiClient.get<{ tag: Tag }>(`/tags/${id}`);
    return response.data;
  },

  create: async (data: CreateTagRequest): Promise<{ tag: Tag; message: string }> => {
    const response = await apiClient.post<{ tag: Tag; message: string }>('/tags', data);
    return response.data;
  },

  update: async (id: string, data: UpdateTagRequest): Promise<{ tag: Tag; message: string }> => {
    const response = await apiClient.put<{ tag: Tag; message: string }>(`/tags/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<{ message: string }> => {
    const response = await apiClient.delete<{ message: string }>(`/tags/${id}`);
    return response.data;
  },

  bulkCreate: async (data: BulkCreateTagRequest): Promise<{ tags: Tag[]; message: string }> => {
    const response = await apiClient.post<{ tags: Tag[]; message: string }>('/tags/bulk', data);
    return response.data;
  },

  seedDefaults: async (): Promise<{ tags: Tag[]; message: string }> => {
    const response = await apiClient.post<{ tags: Tag[]; message: string }>('/tags/seed-defaults');
    return response.data;
  },

  // Entity tagging
  getEntitiesForTag: async (tagId: string): Promise<TagEntitiesResponse> => {
    const response = await apiClient.get<TagEntitiesResponse>(`/tags/${tagId}/entities`);
    return response.data;
  },

  getTagsForEntity: async (
    entityType: EntityType,
    entityId: string
  ): Promise<{ tags: Tag[] }> => {
    const response = await apiClient.get<{ tags: Tag[] }>(
      `/tags/entities/${entityType}/${entityId}`
    );
    return response.data;
  },

  addTagToEntity: async (
    tagId: string,
    entityType: EntityType,
    entityId: string
  ): Promise<{ message: string }> => {
    const response = await apiClient.post<{ message: string }>(
      `/tags/${tagId}/entities/${entityType}/${entityId}`
    );
    return response.data;
  },

  removeTagFromEntity: async (
    tagId: string,
    entityType: EntityType,
    entityId: string
  ): Promise<{ message: string }> => {
    const response = await apiClient.delete<{ message: string }>(
      `/tags/${tagId}/entities/${entityType}/${entityId}`
    );
    return response.data;
  },
};

// Import API for migrating from PagerDuty/Opsgenie
export interface ImportPreviewResult {
  source: 'pagerduty' | 'opsgenie';
  preview: {
    users: Array<{ email: string; name: string; role: string; action: 'create' | 'match' }>;
    teams: Array<{ name: string; memberCount: number }>;
    schedules: Array<{ name: string; type: string; layerCount: number }>;
    escalationPolicies: Array<{ name: string; stepCount: number }>;
    services: Array<{ name: string; description: string }>;
  };
  warnings: string[];
  estimatedChanges: {
    usersToCreate: number;
    usersToMatch: number;
    teamsToCreate: number;
    schedulesToCreate: number;
    policiesToCreate: number;
    servicesToCreate: number;
  };
}

export interface ImportResult {
  success: boolean;
  message: string;
  imported: {
    users: number;
    teams: number;
    schedules: number;
    escalationPolicies: number;
    services: number;
  };
  idMappings: {
    users: Record<string, string>;
    teams: Record<string, string>;
    schedules: Record<string, string>;
    escalationPolicies: Record<string, string>;
    services: Record<string, string>;
  };
  errors: string[];
  warnings: string[];
}

export interface FetchTestResult {
  success: boolean;
  account?: any;
  error?: string;
}

export interface PagerDutyFetchOptions {
  apiKey: string;
  subdomain?: string;
  includeUsers?: boolean;
  includeTeams?: boolean;
  includeSchedules?: boolean;
  includeEscalationPolicies?: boolean;
  includeServices?: boolean;
  includeMaintenanceWindows?: boolean;
  includeRoutingRules?: boolean;
  includeServiceDependencies?: boolean;
  includeIncidents?: boolean;
  incidentDateRange?: { since?: string; until?: string };
}

export interface OpsgenieFetchOptions {
  apiKey: string;
  region?: 'us' | 'eu';
  includeUsers?: boolean;
  includeTeams?: boolean;
  includeSchedules?: boolean;
  includeEscalations?: boolean;
  includeServices?: boolean;
  includeHeartbeats?: boolean;
  includeMaintenanceWindows?: boolean;
  includeAlertPolicies?: boolean;
  includeAlerts?: boolean;
  alertDateRange?: { since?: string; until?: string };
}

export interface FetchResult {
  success: boolean;
  data?: any;
  error?: string;
}

export interface ValidationReport {
  source: 'pagerduty' | 'opsgenie';
  validatedAt: string;
  summary: {
    users: { matched: number; missing: number; different: number; extra: number };
    teams: { matched: number; missing: number; different: number; extra: number };
    schedules: { matched: number; missing: number; different: number; extra: number };
    escalationPolicies: { matched: number; missing: number; different: number; extra: number };
    services: { matched: number; missing: number; different: number; extra: number };
  };
  suggestions: string[];
  configurationGaps: string[];
}

export const importAPI = {
  preview: async (source: 'pagerduty' | 'opsgenie', data: any): Promise<ImportPreviewResult> => {
    const response = await apiClient.post<ImportPreviewResult>('/import/preview', {
      source,
      data,
    });
    return response.data;
  },

  importPagerDuty: async (data: any, options?: { preserveKeys?: boolean }): Promise<ImportResult> => {
    const response = await apiClient.post<ImportResult>('/import/pagerduty', data, {
      params: options,
    });
    return response.data;
  },

  importOpsgenie: async (data: any, options?: { preserveKeys?: boolean }): Promise<ImportResult> => {
    const response = await apiClient.post<ImportResult>('/import/opsgenie', data, {
      params: options,
    });
    return response.data;
  },

  // Test PagerDuty API connection
  testPagerDuty: async (apiKey: string): Promise<FetchTestResult> => {
    const response = await apiClient.post<FetchTestResult>('/import/fetch/pagerduty/test', {
      apiKey,
    });
    return response.data;
  },

  // Test Opsgenie API connection
  testOpsgenie: async (apiKey: string, region: 'us' | 'eu' = 'us'): Promise<FetchTestResult> => {
    const response = await apiClient.post<FetchTestResult>('/import/fetch/opsgenie/test', {
      apiKey,
      region,
    });
    return response.data;
  },

  // Fetch data from PagerDuty
  fetchPagerDuty: async (options: PagerDutyFetchOptions): Promise<FetchResult> => {
    const response = await apiClient.post<FetchResult>('/import/fetch/pagerduty', options);
    return response.data;
  },

  // Fetch data from Opsgenie
  fetchOpsgenie: async (options: OpsgenieFetchOptions): Promise<FetchResult> => {
    const response = await apiClient.post<FetchResult>('/import/fetch/opsgenie', options);
    return response.data;
  },

  // Validate migration
  validate: async (source: 'pagerduty' | 'opsgenie', data: any): Promise<{ success: boolean; report: ValidationReport }> => {
    const response = await apiClient.post<{ success: boolean; report: ValidationReport }>('/import/validate', {
      source,
      data,
    });
    return response.data;
  },
};

// Status Pages API
export interface StatusPage {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  visibility: 'internal' | 'public';
  customDomain: string | null;
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string;
  showUptimeHistory: boolean;
  uptimeHistoryDays: number;
  allowSubscriptions: boolean;
  enabled: boolean;
  services: {
    id: string;
    name: string;
    displayOrder: number;
    showIncidents: boolean;
  }[];
  subscriberCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface StatusPageUpdate {
  id: string;
  title: string;
  message: string;
  status: 'investigating' | 'identified' | 'monitoring' | 'resolved';
  severity: 'none' | 'minor' | 'major' | 'critical';
  affectedServiceIds: string[];
  author: { id: string; fullName: string } | null;
  incidentId: string | null;
  isScheduled: boolean;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StatusPageSubscriber {
  id: string;
  email: string;
  channel: string;
  confirmed: boolean;
  active: boolean;
  createdAt: string;
}

export interface CreateStatusPageRequest {
  name: string;
  slug: string;
  description?: string;
  visibility?: 'internal' | 'public';
  primaryColor?: string;
  showUptimeHistory?: boolean;
  uptimeHistoryDays?: number;
  allowSubscriptions?: boolean;
  serviceIds?: string[];
}

export interface UpdateStatusPageRequest {
  name?: string;
  slug?: string;
  description?: string;
  visibility?: 'internal' | 'public';
  primaryColor?: string;
  showUptimeHistory?: boolean;
  uptimeHistoryDays?: number;
  allowSubscriptions?: boolean;
  enabled?: boolean;
  logoUrl?: string;
  customDomain?: string;
  serviceIds?: string[];
}

export interface CreateStatusUpdateRequest {
  title: string;
  message: string;
  status: 'investigating' | 'identified' | 'monitoring' | 'resolved';
  severity?: 'none' | 'minor' | 'major' | 'critical';
  affectedServiceIds?: string[];
  incidentId?: string;
  isScheduled?: boolean;
  scheduledStart?: string;
  scheduledEnd?: string;
}

export const statusPagesAPI = {
  list: async (): Promise<{ statusPages: StatusPage[] }> => {
    const response = await apiClient.get<{ statusPages: StatusPage[] }>('/status-pages');
    return response.data;
  },

  get: async (id: string): Promise<{ statusPage: StatusPage }> => {
    const response = await apiClient.get<{ statusPage: StatusPage }>(`/status-pages/${id}`);
    return response.data;
  },

  create: async (data: CreateStatusPageRequest): Promise<{ statusPage: StatusPage }> => {
    const response = await apiClient.post<{ statusPage: StatusPage }>('/status-pages', data);
    return response.data;
  },

  update: async (id: string, data: UpdateStatusPageRequest): Promise<{ statusPage: StatusPage }> => {
    const response = await apiClient.put<{ statusPage: StatusPage }>(`/status-pages/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<{ message: string }> => {
    const response = await apiClient.delete<{ message: string }>(`/status-pages/${id}`);
    return response.data;
  },

  // Updates
  getUpdates: async (id: string): Promise<{ updates: StatusPageUpdate[] }> => {
    const response = await apiClient.get<{ updates: StatusPageUpdate[] }>(`/status-pages/${id}/updates`);
    return response.data;
  },

  createUpdate: async (id: string, data: CreateStatusUpdateRequest): Promise<{ update: StatusPageUpdate }> => {
    const response = await apiClient.post<{ update: StatusPageUpdate }>(`/status-pages/${id}/updates`, data);
    return response.data;
  },

  // Subscribers
  getSubscribers: async (id: string): Promise<{ subscribers: StatusPageSubscriber[] }> => {
    const response = await apiClient.get<{ subscribers: StatusPageSubscriber[] }>(`/status-pages/${id}/subscribers`);
    return response.data;
  },

  removeSubscriber: async (statusPageId: string, subscriberId: string): Promise<{ message: string }> => {
    const response = await apiClient.delete<{ message: string }>(`/status-pages/${statusPageId}/subscribers/${subscriberId}`);
    return response.data;
  },
};

// Analytics API
export interface AnalyticsOverview {
  period: { startDate: string; endDate: string };
  totalIncidents: number;
  byState: { triggered: number; acknowledged: number; resolved: number };
  bySeverity: { critical: number; high: number; medium: number; low: number };
  mtta: { minutes: number; formatted: string } | null;
  mttr: { minutes: number; formatted: string } | null;
  incidentsByDay: Array<{ date: string; count: number }>;
}

export interface AnalyticsTeam {
  id: string;
  name: string;
  incidentCount: number;
  mtta: { minutes: number; formatted: string } | null;
  mttr: { minutes: number; formatted: string } | null;
}

export interface TeamAnalyticsDetail {
  team: { id: string; name: string };
  period: { startDate: string; endDate: string };
  totalIncidents: number;
  byState: { triggered: number; acknowledged: number; resolved: number };
  bySeverity: { critical: number; high: number; medium: number; low: number };
  mtta: { minutes: number; formatted: string } | null;
  mttr: { minutes: number; formatted: string } | null;
  incidentsByDay: Array<{ date: string; count: number }>;
  topServices: Array<{ id: string; name: string; incidentCount: number }>;
}

export interface UserAnalyticsDetail {
  user: { id: string; fullName: string; email: string };
  period: { startDate: string; endDate: string };
  incidentsAssigned: number;
  incidentsAcknowledged: number;
  incidentsResolved: number;
  averageResponseTimeMinutes: number | null;
  incidentsByDay: Array<{ date: string; count: number }>;
}

export interface TopResponder {
  id: string;
  fullName: string;
  email: string;
  profilePictureUrl: string | null;
  incidentsResolved: number;
  incidentsAcknowledged: number;
  averageResponseTimeMinutes: number | null;
}

export interface SLAData {
  period: { startDate: string; endDate: string };
  targets: { ackTargetMinutes: number; resolveTargetMinutes: number };
  overall: {
    totalIncidents: number;
    ackWithinTarget: number;
    resolveWithinTarget: number;
    ackComplianceRate: number;
    resolveComplianceRate: number;
  };
  bySeverity: Array<{
    severity: string;
    totalIncidents: number;
    ackWithinTarget: number;
    resolveWithinTarget: number;
    ackComplianceRate: number;
    resolveComplianceRate: number;
  }>;
  byService: Array<{
    serviceId: string;
    serviceName: string;
    totalIncidents: number;
    ackWithinTarget: number;
    resolveWithinTarget: number;
    ackComplianceRate: number;
    resolveComplianceRate: number;
  }>;
  dailyTrend: Array<{
    date: string;
    ackComplianceRate: number;
    resolveComplianceRate: number;
  }>;
}

export const analyticsAPI = {
  getOverview: async (startDate?: string, endDate?: string): Promise<AnalyticsOverview> => {
    const params: Record<string, string> = {};
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    const response = await apiClient.get<AnalyticsOverview>('/analytics/overview', { params });
    return response.data;
  },

  getTeams: async (): Promise<{ teams: AnalyticsTeam[] }> => {
    const response = await apiClient.get<{ teams: AnalyticsTeam[] }>('/analytics/teams');
    return response.data;
  },

  getTeamAnalytics: async (
    teamId: string,
    startDate?: string,
    endDate?: string
  ): Promise<TeamAnalyticsDetail> => {
    const params: Record<string, string> = {};
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    const response = await apiClient.get<TeamAnalyticsDetail>(`/analytics/teams/${teamId}`, { params });
    return response.data;
  },

  getUserAnalytics: async (
    userId: string,
    startDate?: string,
    endDate?: string
  ): Promise<UserAnalyticsDetail> => {
    const params: Record<string, string> = {};
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    const response = await apiClient.get<UserAnalyticsDetail>(`/analytics/users/${userId}`, { params });
    return response.data;
  },

  getTopResponders: async (
    startDate?: string,
    endDate?: string,
    limit?: number
  ): Promise<{ responders: TopResponder[] }> => {
    const params: Record<string, string | number> = {};
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    if (limit) params.limit = limit;
    const response = await apiClient.get<{ responders: TopResponder[] }>('/analytics/top-responders', { params });
    return response.data;
  },

  getSLA: async (
    startDate?: string,
    endDate?: string,
    ackTargetMinutes?: number,
    resolveTargetMinutes?: number
  ): Promise<SLAData> => {
    const params: Record<string, string | number> = {};
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    if (ackTargetMinutes) params.ackTargetMinutes = ackTargetMinutes;
    if (resolveTargetMinutes) params.resolveTargetMinutes = resolveTargetMinutes;
    const response = await apiClient.get<SLAData>('/analytics/sla', { params });
    return response.data;
  },
};

// Postmortems API
export const postmortemsAPI = {
  list: async (params?: { status?: string; limit?: number; offset?: number }): Promise<{ postmortems: Postmortem[]; pagination: { total: number; limit: number; offset: number } }> => {
    const response = await apiClient.get<{ postmortems: Postmortem[]; pagination: { total: number; limit: number; offset: number } }>('/postmortems', { params });
    return response.data;
  },

  get: async (id: string): Promise<{ postmortem: Postmortem }> => {
    const response = await apiClient.get<{ postmortem: Postmortem }>(`/postmortems/${id}`);
    return response.data;
  },

  create: async (data: CreatePostmortemRequest): Promise<{ postmortem: Postmortem }> => {
    const response = await apiClient.post<{ postmortem: Postmortem }>('/postmortems', data);
    return response.data;
  },

  update: async (id: string, data: UpdatePostmortemRequest): Promise<{ postmortem: Postmortem }> => {
    const response = await apiClient.put<{ postmortem: Postmortem }>(`/postmortems/${id}`, data);
    return response.data;
  },

  publish: async (id: string): Promise<{ postmortem: Postmortem; message: string }> => {
    const response = await apiClient.post<{ postmortem: Postmortem; message: string }>(`/postmortems/${id}/publish`);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/postmortems/${id}`);
  },

  listTemplates: async (): Promise<{ templates: PostmortemTemplate[] }> => {
    const response = await apiClient.get<{ templates: PostmortemTemplate[] }>('/postmortems/templates/list');
    return response.data;
  },

  createTemplate: async (data: CreatePostmortemTemplateRequest): Promise<{ template: PostmortemTemplate }> => {
    const response = await apiClient.post<{ template: PostmortemTemplate }>('/postmortems/templates', data);
    return response.data;
  },
};

export default apiClient;
