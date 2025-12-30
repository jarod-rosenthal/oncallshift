import axios from 'axios';
import { config } from '../config';
import { getAccessToken, signOut } from './authService';

const apiClient = axios.create({
  baseURL: config.apiUrl,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to all requests
apiClient.interceptors.request.use(
  async (config) => {
    const token = await getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handle 401 errors by signing out
let isSigningOut = false;
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 && !isSigningOut) {
      // Token expired or invalid - clear auth state
      isSigningOut = true;
      console.log('Session expired, signing out...');
      await signOut();
      isSigningOut = false;
      // The app will detect the logout and redirect to login
    }
    return Promise.reject(error);
  }
);

// ============ TYPES ============

export interface Incident {
  id: string;
  incidentNumber: number;
  summary: string;
  details: any;
  severity: 'critical' | 'error' | 'warning' | 'info';
  state: 'triggered' | 'acknowledged' | 'resolved';
  service: {
    id: string;
    name: string;
  };
  triggeredAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  acknowledgedBy?: {
    id: string;
    fullName: string;
    email: string;
  };
  resolvedBy?: {
    id: string;
    fullName: string;
    email: string;
  };
  eventCount: number;
  lastEventAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface IncidentEvent {
  id: string;
  type: 'trigger' | 'acknowledge' | 'resolve' | 'note' | 'escalate';
  message?: string;
  user?: {
    id: string;
    fullName: string;
    email: string;
  };
  createdAt: string;
}

export interface IncidentListResponse {
  incidents: Incident[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
}

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  role: 'admin' | 'member';
  phoneNumber?: string;
  settings?: {
    profile?: {
      displayName?: string;
    };
    notificationPreferences?: {
      email?: boolean;
      push?: boolean;
      sms?: boolean;
      quietHoursStart?: string;
      quietHoursEnd?: string;
    };
    profileTimezone?: string;
    availability?: {
      timezone: string;
      weeklyHours: Record<string, { available: boolean; start: string; end: string }>;
      blackoutDates: Array<{ start: string; end: string; reason?: string }>;
    };
  };
  organization: {
    id: string;
    name: string;
    plan: string;
  };
  createdAt: string;
}

export interface OnCallData {
  service: {
    id: string;
    name: string;
  };
  schedule: {
    id: string;
    name: string;
  };
  oncallUser: {
    id: string;
    fullName: string;
    email: string;
  } | null;
  isOverride: boolean;
  overrideUntil?: string;
}

export interface Schedule {
  id: string;
  name: string;
  description?: string;
  type: 'manual' | 'daily' | 'weekly';
  timezone: string;
  currentOncallUserId?: string;
  isOverride: boolean;
  overrideUntil?: string;
  rotationConfig?: any;
  createdAt: string;
  updatedAt: string;
}

export interface Device {
  id: string;
  platform: 'ios' | 'android';
  deviceName?: string;
  appVersion?: string;
  lastUsedAt?: string;
  createdAt: string;
}

// ============ INCIDENTS ============

/**
 * Fetch all incidents
 */
export const getIncidents = async (state?: 'triggered' | 'acknowledged' | 'resolved'): Promise<Incident[]> => {
  try {
    const params = state ? { state } : {};
    const response = await apiClient.get<IncidentListResponse>('/v1/incidents', { params });
    return response.data.incidents;
  } catch (error) {
    console.error('Error fetching incidents:', error);
    throw error;
  }
};

/**
 * Get incident details with timeline
 */
export const getIncidentDetails = async (incidentId: string): Promise<{ incident: Incident; events: IncidentEvent[] }> => {
  try {
    const response = await apiClient.get(`/v1/incidents/${incidentId}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching incident details:', error);
    throw error;
  }
};

/**
 * Acknowledge an incident
 */
export const acknowledgeIncident = async (incidentId: string): Promise<{ incident: Incident; message: string }> => {
  try {
    const response = await apiClient.put(`/v1/incidents/${incidentId}/acknowledge`);
    return response.data;
  } catch (error) {
    console.error('Error acknowledging incident:', error);
    throw error;
  }
};

/**
 * Resolve an incident
 */
export const resolveIncident = async (incidentId: string): Promise<{ incident: Incident; message: string }> => {
  try {
    const response = await apiClient.put(`/v1/incidents/${incidentId}/resolve`);
    return response.data;
  } catch (error) {
    console.error('Error resolving incident:', error);
    throw error;
  }
};

/**
 * Add a note to an incident
 */
export const addIncidentNote = async (incidentId: string, message: string): Promise<{ event: IncidentEvent; message: string }> => {
  try {
    const response = await apiClient.post(`/v1/incidents/${incidentId}/notes`, { message });
    return response.data;
  } catch (error) {
    console.error('Error adding note:', error);
    throw error;
  }
};

// ============ USER PROFILE ============

/**
 * Get current user profile
 */
export const getUserProfile = async (): Promise<UserProfile> => {
  try {
    const response = await apiClient.get('/v1/users/me');
    return response.data.user;
  } catch (error) {
    console.error('Error fetching user profile:', error);
    throw error;
  }
};

/**
 * Update user profile
 */
export const updateUserProfile = async (data: {
  fullName?: string;
  phoneNumber?: string | null;
  displayName?: string | null;
  timezone?: string;
  notificationPreferences?: {
    email?: boolean;
    push?: boolean;
    sms?: boolean;
    quietHoursStart?: string;
    quietHoursEnd?: string;
  };
}): Promise<UserProfile> => {
  try {
    const response = await apiClient.put('/v1/users/me', data);
    return response.data.user;
  } catch (error) {
    console.error('Error updating user profile:', error);
    throw error;
  }
};

// ============ ON-CALL / SCHEDULES ============

/**
 * Get current on-call users across all services
 */
export const getOnCallData = async (): Promise<OnCallData[]> => {
  try {
    const response = await apiClient.get('/v1/schedules/oncall');
    return response.data.oncall;
  } catch (error) {
    console.error('Error fetching on-call data:', error);
    throw error;
  }
};

/**
 * Get all schedules
 */
export const getSchedules = async (): Promise<Schedule[]> => {
  try {
    const response = await apiClient.get('/v1/schedules');
    return response.data.schedules;
  } catch (error) {
    console.error('Error fetching schedules:', error);
    throw error;
  }
};

/**
 * Get schedule details
 */
export const getScheduleDetails = async (scheduleId: string): Promise<{ schedule: Schedule; oncallUser: any }> => {
  try {
    const response = await apiClient.get(`/v1/schedules/${scheduleId}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching schedule details:', error);
    throw error;
  }
};

// ============ DEVICES (PUSH NOTIFICATIONS) ============

/**
 * Register device for push notifications
 */
export const registerDevice = async (data: {
  token: string;
  platform: 'ios' | 'android';
  deviceName?: string;
  appVersion?: string;
}): Promise<Device> => {
  try {
    const response = await apiClient.post('/v1/devices/register', data);
    return response.data.device;
  } catch (error) {
    console.error('Error registering device:', error);
    throw error;
  }
};

/**
 * Get registered devices
 */
export const getDevices = async (): Promise<Device[]> => {
  try {
    const response = await apiClient.get('/v1/devices');
    return response.data.devices;
  } catch (error) {
    console.error('Error fetching devices:', error);
    throw error;
  }
};

/**
 * Unregister device
 */
export const unregisterDevice = async (deviceId: string): Promise<void> => {
  try {
    await apiClient.delete(`/v1/devices/${deviceId}`);
  } catch (error) {
    console.error('Error unregistering device:', error);
    throw error;
  }
};

// Legacy exports for backward compatibility
export type Alert = Incident;
export const getAlerts = getIncidents;
export const acknowledgeAlert = acknowledgeIncident;
export const resolveAlert = resolveIncident;

// ============ NOTIFICATIONS ============

export interface NotificationItem {
  id: string;
  type: 'incident_triggered' | 'incident_acknowledged' | 'incident_resolved' | 'mention' | 'assigned' | 'escalated';
  title: string;
  body: string;
  incidentId?: string;
  incidentSummary?: string;
  severity?: 'info' | 'warning' | 'error' | 'critical';
  isRead: boolean;
  createdAt: string;
  actor?: {
    id: string;
    name: string;
    email: string;
  };
}

/**
 * Get notification history
 */
export const getNotifications = async (): Promise<NotificationItem[]> => {
  const response = await apiClient.get<{ notifications: NotificationItem[] }>('/v1/notifications');
  return response.data.notifications;
};

/**
 * Mark notification as read
 */
export const markNotificationRead = async (notificationId: string): Promise<void> => {
  await apiClient.put(`/v1/notifications/${notificationId}/read`);
};

/**
 * Mark all notifications as read
 */
export const markAllNotificationsRead = async (): Promise<void> => {
  await apiClient.put('/v1/notifications/read-all');
};

/**
 * Get unread notification count
 */
export const getUnreadNotificationCount = async (): Promise<number> => {
  const response = await apiClient.get<{ count: number }>('/v1/notifications/unread-count');
  return response.data.count;
};
