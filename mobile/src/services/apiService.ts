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
    // Fetch incident details and timeline in parallel
    const [incidentResponse, timelineResponse] = await Promise.all([
      apiClient.get(`/v1/incidents/${incidentId}`),
      apiClient.get(`/v1/incidents/${incidentId}/timeline`),
    ]);

    return {
      incident: incidentResponse.data.incident,
      events: timelineResponse.data.events.map((event: any) => ({
        id: event.id,
        type: event.type,
        message: event.message,
        user: event.actor ? {
          id: event.actor.id,
          fullName: event.actor.fullName,
          email: event.actor.email,
        } : undefined,
        createdAt: event.createdAt,
      })),
    };
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
 * Resolution data for resolving incidents with required context
 */
export interface ResolutionData {
  rootCause?: string;
  resolutionSummary?: string;
  followUpRequired?: boolean;
  followUpUrl?: string;
  note?: string; // Legacy support
}

/**
 * Resolve an incident with optional resolution data
 */
export const resolveIncident = async (
  incidentId: string,
  data?: string | ResolutionData
): Promise<{ incident: Incident; message: string }> => {
  try {
    let payload: ResolutionData | undefined;

    if (typeof data === 'string') {
      // Legacy support: string is treated as note
      payload = { note: data };
    } else if (data) {
      payload = {
        ...data,
        // Combine root cause and summary into note for backend compatibility
        note: data.resolutionSummary
          ? `[${data.rootCause?.replace(/_/g, ' ').toUpperCase()}] ${data.resolutionSummary}${data.followUpRequired ? ' (Follow-up required' + (data.followUpUrl ? `: ${data.followUpUrl}` : '') + ')' : ''}`
          : data.note,
      };
    }

    const response = await apiClient.put(`/v1/incidents/${incidentId}/resolve`, payload);
    return response.data;
  } catch (error) {
    console.error('Error resolving incident:', error);
    throw error;
  }
};

/**
 * Add a note to an incident
 */
export const addIncidentNote = async (incidentId: string, content: string): Promise<{ event: IncidentEvent; message: string }> => {
  try {
    const response = await apiClient.post(`/v1/incidents/${incidentId}/notes`, { content });
    return response.data;
  } catch (error) {
    console.error('Error adding note:', error);
    throw error;
  }
};

// ============ INCIDENT NOTIFICATIONS ============

export interface NotificationChannel {
  channel: 'push' | 'email' | 'sms' | 'voice';
  status: 'pending' | 'sent' | 'delivered' | 'failed';
  sentAt: string | null;
  deliveredAt: string | null;
  failedAt: string | null;
  errorMessage: string | null;
}

export interface UserNotification {
  userId: string;
  userName: string;
  userEmail: string;
  channels: NotificationChannel[];
}

export interface NotificationSummary {
  total: number;
  pending: number;
  sent: number;
  delivered: number;
  failed: number;
}

export interface IncidentNotificationsResponse {
  notifications: UserNotification[];
  summary: NotificationSummary;
}

/**
 * Get notification statuses for an incident
 */
export const getIncidentNotifications = async (incidentId: string): Promise<IncidentNotificationsResponse> => {
  try {
    const response = await apiClient.get<IncidentNotificationsResponse>(`/v1/incidents/${incidentId}/notifications`);
    return response.data;
  } catch (error) {
    console.error('Error fetching incident notifications:', error);
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

// ============ ADDITIONAL INCIDENT ACTIONS ============

/**
 * Escalate an incident to the next escalation step
 */
export const escalateIncident = async (
  incidentId: string,
  reason?: string
): Promise<{ incident: Incident; message: string }> => {
  try {
    const response = await apiClient.post(`/v1/incidents/${incidentId}/escalate`, { reason });
    return response.data;
  } catch (error) {
    console.error('Error escalating incident:', error);
    throw error;
  }
};

/**
 * Reassign an incident to another user
 */
export const reassignIncident = async (
  incidentId: string,
  assignToUserId: string,
  reason?: string,
  notifyOriginalAssignee: boolean = true
): Promise<{ incident: Incident; message: string }> => {
  try {
    const response = await apiClient.put(`/v1/incidents/${incidentId}/reassign`, {
      assignToUserId,
      reason,
      notifyOriginalAssignee,
    });
    return response.data;
  } catch (error) {
    console.error('Error reassigning incident:', error);
    throw error;
  }
};

/**
 * Unacknowledge an incident (revert to triggered)
 */
export const unacknowledgeIncident = async (incidentId: string): Promise<{ incident: Incident; message: string }> => {
  try {
    const response = await apiClient.put(`/v1/incidents/${incidentId}/unacknowledge`);
    return response.data;
  } catch (error) {
    console.error('Error unacknowledging incident:', error);
    throw error;
  }
};

/**
 * Unresolve an incident (revert to triggered)
 */
export const unresolveIncident = async (incidentId: string): Promise<{ incident: Incident; message: string }> => {
  try {
    const response = await apiClient.put(`/v1/incidents/${incidentId}/unresolve`);
    return response.data;
  } catch (error) {
    console.error('Error unresolving incident:', error);
    throw error;
  }
};

/**
 * Delete an incident (admin only)
 */
export const deleteIncident = async (incidentId: string): Promise<{ message: string; deleted: { id: string; incidentNumber: number; summary: string } }> => {
  try {
    const response = await apiClient.delete(`/v1/incidents/${incidentId}`);
    return response.data;
  } catch (error) {
    console.error('Error deleting incident:', error);
    throw error;
  }
};

// ============ SCHEDULE OVERRIDES ============

/**
 * Create a temporary on-call override
 */
export const createScheduleOverride = async (
  scheduleId: string,
  userId: string,
  until: string
): Promise<{ schedule: Schedule; message: string }> => {
  try {
    const response = await apiClient.post(`/v1/schedules/${scheduleId}/override`, {
      userId,
      until,
    });
    return response.data;
  } catch (error) {
    console.error('Error creating schedule override:', error);
    throw error;
  }
};

/**
 * Remove an on-call override
 */
export const removeScheduleOverride = async (scheduleId: string): Promise<{ schedule: Schedule; message: string }> => {
  try {
    const response = await apiClient.delete(`/v1/schedules/${scheduleId}/override`);
    return response.data;
  } catch (error) {
    console.error('Error removing schedule override:', error);
    throw error;
  }
};

/**
 * Get schedule members (rotation list)
 */
export interface ScheduleMember {
  id: string;
  userId: string;
  user: {
    id: string;
    fullName: string;
    email: string;
  };
  position: number;
}

export const getScheduleMembers = async (scheduleId: string): Promise<ScheduleMember[]> => {
  try {
    const response = await apiClient.get(`/v1/schedules/${scheduleId}/members`);
    return response.data.members;
  } catch (error) {
    console.error('Error fetching schedule members:', error);
    throw error;
  }
};

/**
 * Set current on-call user (manual schedules)
 */
export const setScheduleOncall = async (
  scheduleId: string,
  userId: string
): Promise<{ schedule: Schedule; message: string }> => {
  try {
    const response = await apiClient.put(`/v1/schedules/${scheduleId}/oncall`, { userId });
    return response.data;
  } catch (error) {
    console.error('Error setting schedule on-call:', error);
    throw error;
  }
};

// ============ USERS ============

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: 'admin' | 'member';
  status: 'active' | 'inactive';
  phoneNumber?: string;
  hasAvailability: boolean;
  createdAt: string;
}

/**
 * Get list of users in organization
 */
export const getUsers = async (options?: {
  hasAvailability?: boolean;
  includeInactive?: boolean;
}): Promise<User[]> => {
  try {
    const response = await apiClient.get('/v1/users', { params: options });
    return response.data.users;
  } catch (error) {
    console.error('Error fetching users:', error);
    throw error;
  }
};

// Alias for backward compatibility
export const getTeamMembers = getUsers;

/**
 * Get user availability settings
 */
export interface UserAvailability {
  timezone: string;
  weeklyHours: Record<string, { available: boolean; start: string; end: string }>;
  blackoutDates: Array<{ start: string; end: string; reason?: string }>;
}

export const getUserAvailability = async (): Promise<UserAvailability> => {
  try {
    const response = await apiClient.get('/v1/users/me/availability');
    return response.data.availability;
  } catch (error) {
    console.error('Error fetching user availability:', error);
    throw error;
  }
};

/**
 * Update user availability settings
 */
export const updateUserAvailability = async (data: UserAvailability): Promise<UserAvailability> => {
  try {
    const response = await apiClient.put('/v1/users/me/availability', data);
    return response.data.availability;
  } catch (error) {
    console.error('Error updating user availability:', error);
    throw error;
  }
};

// ============ SERVICES ============

export interface Service {
  id: string;
  name: string;
  description?: string;
  status: 'active' | 'inactive' | 'maintenance';
  scheduleId?: string;
  escalationPolicyId?: string;
  schedule?: Schedule;
  escalationPolicy?: {
    id: string;
    name: string;
  };
  createdAt: string;
  updatedAt: string;
}

/**
 * Get list of services
 */
export const getServices = async (): Promise<Service[]> => {
  try {
    const response = await apiClient.get('/v1/services');
    return response.data.services;
  } catch (error) {
    console.error('Error fetching services:', error);
    throw error;
  }
};

/**
 * Get service details
 */
export const getServiceDetails = async (serviceId: string): Promise<Service> => {
  try {
    const response = await apiClient.get(`/v1/services/${serviceId}`);
    return response.data.service;
  } catch (error) {
    console.error('Error fetching service details:', error);
    throw error;
  }
};

// ============ AI DIAGNOSIS ============

export interface SuggestedAction {
  title: string;
  description: string;
  command?: string;
  risk: 'low' | 'medium' | 'high';
  automated: boolean;
}

export interface AIDiagnosisResult {
  summary: string;
  rootCause: string;
  affectedComponents: string[];
  suggestedActions: SuggestedAction[];
  confidence: 'high' | 'medium' | 'low';
  additionalContext?: string;
}

export interface AIDiagnosisResponse {
  diagnosis: AIDiagnosisResult;
  logsAnalyzed: number;
  analysisTime: number;
}

// Legacy format for backward compatibility with UI
export interface LegacyAIDiagnosisResponse {
  analysis: string;
  suggestedActions: { action: string; command: string; risk: 'low' | 'medium' | 'high' }[];
  relevantLogs: string[];
}

/**
 * Get AI diagnosis for an incident
 */
export const diagnoseIncident = async (
  incidentId: string,
  options: { lookbackMinutes?: number; includeAllServices?: boolean } = {}
): Promise<LegacyAIDiagnosisResponse> => {
  try {
    // AI diagnosis can take 30-60 seconds, so use a longer timeout
    const response = await apiClient.post<AIDiagnosisResponse>(
      `/v1/incidents/${incidentId}/diagnose`,
      {
        lookbackMinutes: options.lookbackMinutes || 60,
        includeAllServices: options.includeAllServices || false,
      },
      { timeout: 90000 } // 90 second timeout for AI analysis
    );

    const { diagnosis, logsAnalyzed } = response.data;

    // Transform to legacy format expected by UI
    return {
      analysis: `${diagnosis.summary}\n\n**Root Cause:**\n${diagnosis.rootCause}\n\n**Affected Components:** ${diagnosis.affectedComponents.join(', ')}\n\n**Confidence:** ${diagnosis.confidence}${diagnosis.additionalContext ? `\n\n**Additional Context:**\n${diagnosis.additionalContext}` : ''}`,
      suggestedActions: diagnosis.suggestedActions.map((action) => ({
        action: action.title,
        command: action.command || '',
        risk: action.risk,
      })),
      relevantLogs: [`${logsAnalyzed} log entries analyzed`],
    };
  } catch (error) {
    console.error('Error getting AI diagnosis:', error);
    throw error;
  }
};

// ============ ADMIN: ESCALATION POLICIES ============

export interface EscalationTarget {
  id: string;
  targetType: 'user' | 'schedule';
  userId?: string;
  user?: { id: string; fullName: string; email: string };
  scheduleId?: string;
  schedule?: { id: string; name: string };
}

export interface EscalationStep {
  id: string;
  escalationLevel: number;
  stepOrder?: number; // New API field
  delayMinutes: number;
  timeoutSeconds?: number; // New API field (seconds)
  targetType: 'user' | 'schedule';
  targetId: string;
  targetName?: string;
  scheduleId?: string;
  schedule?: { id: string; name: string };
  userIds?: string[];
  targets?: EscalationTarget[]; // New multi-target support
  // Resolved user info from backend
  resolvedOncallUser?: { id: string; fullName: string; email: string };
  resolvedUsers?: Array<{ id: string; fullName: string; email: string }>;
}

export interface EscalationPolicy {
  id: string;
  name: string;
  description?: string;
  repeatEnabled?: boolean; // New repeat support
  repeatCount?: number; // 0 = infinite
  steps: EscalationStep[];
  servicesCount?: number;
  createdAt: string;
  updatedAt: string;
}

export const getEscalationPolicies = async (): Promise<EscalationPolicy[]> => {
  try {
    const response = await apiClient.get('/v1/escalation-policies');
    return response.data.policies;
  } catch (error) {
    console.error('Error fetching escalation policies:', error);
    throw error;
  }
};

export const getEscalationPolicy = async (policyId: string): Promise<EscalationPolicy> => {
  try {
    const response = await apiClient.get(`/v1/escalation-policies/${policyId}`);
    return response.data.policy;
  } catch (error) {
    console.error('Error fetching escalation policy:', error);
    throw error;
  }
};

export const createEscalationPolicy = async (data: {
  name: string;
  description?: string;
  steps?: Array<{ delayMinutes: number; targetType: 'user' | 'schedule'; targetId: string }>;
}): Promise<EscalationPolicy> => {
  try {
    const response = await apiClient.post('/v1/escalation-policies', data);
    return response.data.policy;
  } catch (error) {
    console.error('Error creating escalation policy:', error);
    throw error;
  }
};

export const updateEscalationPolicy = async (
  policyId: string,
  data: { name?: string; description?: string }
): Promise<EscalationPolicy> => {
  try {
    const response = await apiClient.put(`/v1/escalation-policies/${policyId}`, data);
    return response.data.policy;
  } catch (error) {
    console.error('Error updating escalation policy:', error);
    throw error;
  }
};

export const deleteEscalationPolicy = async (policyId: string): Promise<void> => {
  try {
    await apiClient.delete(`/v1/escalation-policies/${policyId}`);
  } catch (error) {
    console.error('Error deleting escalation policy:', error);
    throw error;
  }
};

export const addEscalationStep = async (
  policyId: string,
  step: { delayMinutes: number; targetType: 'user' | 'schedule'; targetId: string }
): Promise<EscalationPolicy> => {
  try {
    const response = await apiClient.post(`/v1/escalation-policies/${policyId}/steps`, step);
    return response.data.policy;
  } catch (error) {
    console.error('Error adding escalation step:', error);
    throw error;
  }
};

export const updateEscalationStep = async (
  policyId: string,
  stepId: string,
  data: { delayMinutes?: number; targetType?: 'user' | 'schedule'; targetId?: string }
): Promise<EscalationPolicy> => {
  try {
    const response = await apiClient.put(`/v1/escalation-policies/${policyId}/steps/${stepId}`, data);
    return response.data.policy;
  } catch (error) {
    console.error('Error updating escalation step:', error);
    throw error;
  }
};

export const deleteEscalationStep = async (policyId: string, stepId: string): Promise<void> => {
  try {
    await apiClient.delete(`/v1/escalation-policies/${policyId}/steps/${stepId}`);
  } catch (error) {
    console.error('Error deleting escalation step:', error);
    throw error;
  }
};

// ============ ADMIN: SCHEDULE MANAGEMENT ============

export const createSchedule = async (data: {
  name: string;
  type: 'manual' | 'daily' | 'weekly';
  timezone: string;
  description?: string;
}): Promise<Schedule> => {
  try {
    const response = await apiClient.post('/v1/schedules', data);
    return response.data.schedule;
  } catch (error) {
    console.error('Error creating schedule:', error);
    throw error;
  }
};

export const updateSchedule = async (
  scheduleId: string,
  data: { name?: string; description?: string; timezone?: string }
): Promise<Schedule> => {
  try {
    const response = await apiClient.put(`/v1/schedules/${scheduleId}`, data);
    return response.data.schedule;
  } catch (error) {
    console.error('Error updating schedule:', error);
    throw error;
  }
};

export const deleteSchedule = async (scheduleId: string): Promise<void> => {
  try {
    await apiClient.delete(`/v1/schedules/${scheduleId}`);
  } catch (error) {
    console.error('Error deleting schedule:', error);
    throw error;
  }
};

export const addScheduleMember = async (
  scheduleId: string,
  userId: string
): Promise<ScheduleMember> => {
  try {
    const response = await apiClient.post(`/v1/schedules/${scheduleId}/members`, { userId });
    return response.data.member;
  } catch (error) {
    console.error('Error adding schedule member:', error);
    throw error;
  }
};

export const removeScheduleMember = async (scheduleId: string, memberId: string): Promise<void> => {
  try {
    await apiClient.delete(`/v1/schedules/${scheduleId}/members/${memberId}`);
  } catch (error) {
    console.error('Error removing schedule member:', error);
    throw error;
  }
};

export const updateMemberPosition = async (
  scheduleId: string,
  memberId: string,
  position: number
): Promise<void> => {
  try {
    await apiClient.put(`/v1/schedules/${scheduleId}/members/${memberId}/position`, { position });
  } catch (error) {
    console.error('Error updating member position:', error);
    throw error;
  }
};

export const updateScheduleRotation = async (
  scheduleId: string,
  config: { type: 'manual' | 'daily' | 'weekly'; handoffTime?: string; handoffDay?: number }
): Promise<Schedule> => {
  try {
    const response = await apiClient.put(`/v1/schedules/${scheduleId}/rotation`, config);
    return response.data.schedule;
  } catch (error) {
    console.error('Error updating schedule rotation:', error);
    throw error;
  }
};

// ============ ADMIN: SERVICE MANAGEMENT ============

export const createService = async (data: {
  name: string;
  description?: string;
  escalationPolicyId?: string;
  scheduleId?: string;
}): Promise<Service> => {
  try {
    const response = await apiClient.post('/v1/services', data);
    return response.data.service;
  } catch (error) {
    console.error('Error creating service:', error);
    throw error;
  }
};

export const updateService = async (
  serviceId: string,
  data: {
    name?: string;
    description?: string;
    status?: 'active' | 'inactive';
    escalationPolicyId?: string;
    scheduleId?: string;
  }
): Promise<Service> => {
  try {
    const response = await apiClient.put(`/v1/services/${serviceId}`, data);
    return response.data.service;
  } catch (error) {
    console.error('Error updating service:', error);
    throw error;
  }
};

export const deleteService = async (serviceId: string): Promise<void> => {
  try {
    await apiClient.delete(`/v1/services/${serviceId}`);
  } catch (error) {
    console.error('Error deleting service:', error);
    throw error;
  }
};

export const regenerateServiceApiKey = async (serviceId: string): Promise<{ apiKey: string }> => {
  try {
    const response = await apiClient.post(`/v1/services/${serviceId}/regenerate-key`);
    return response.data;
  } catch (error) {
    console.error('Error regenerating service API key:', error);
    throw error;
  }
};

// ============ ADMIN: USER MANAGEMENT ============

export const inviteUser = async (
  email: string,
  role: 'admin' | 'member'
): Promise<User> => {
  try {
    const response = await apiClient.post('/v1/users/invite', { email, role });
    return response.data.user;
  } catch (error) {
    console.error('Error inviting user:', error);
    throw error;
  }
};

export const updateUserRole = async (
  userId: string,
  role: 'admin' | 'member'
): Promise<User> => {
  try {
    const response = await apiClient.put(`/v1/users/${userId}/role`, { role });
    return response.data.user;
  } catch (error) {
    console.error('Error updating user role:', error);
    throw error;
  }
};

export const updateUserStatus = async (
  userId: string,
  isActive: boolean
): Promise<User> => {
  try {
    const response = await apiClient.put(`/v1/users/${userId}/status`, { isActive });
    return response.data.user;
  } catch (error) {
    console.error('Error updating user status:', error);
    throw error;
  }
};

// ============ ANTHROPIC CREDENTIALS (AI DIAGNOSIS) ============

export interface AnthropicCredentialStatus {
  configured: boolean;
  type?: 'api_key' | 'oauth';
  hint?: string;
  hasRefreshToken?: boolean;
  updatedAt?: string;
  message?: string;
}

/**
 * Get Anthropic credential status for current user
 */
export const getAnthropicCredentialStatus = async (): Promise<AnthropicCredentialStatus> => {
  try {
    const response = await apiClient.get<AnthropicCredentialStatus>('/v1/users/me/anthropic-credentials');
    return response.data;
  } catch (error) {
    console.error('Error fetching credential status:', error);
    throw error;
  }
};

/**
 * Save Anthropic credentials (API key or OAuth token)
 */
export const saveAnthropicCredential = async (
  credential: string,
  refreshToken?: string,
  skipValidation?: boolean
): Promise<{
  message: string;
  credential: {
    type: 'api_key' | 'oauth';
    hint: string;
    hasRefreshToken: boolean;
    updatedAt: string;
  };
}> => {
  try {
    const response = await apiClient.post('/v1/users/me/anthropic-credentials', {
      credential,
      refreshToken,
      skipValidation,
    });
    return response.data;
  } catch (error) {
    console.error('Error saving credentials:', error);
    throw error;
  }
};

/**
 * Remove Anthropic credentials
 */
export const removeAnthropicCredential = async (): Promise<{ message: string }> => {
  try {
    const response = await apiClient.delete('/v1/users/me/anthropic-credentials');
    return response.data;
  } catch (error) {
    console.error('Error removing credentials:', error);
    throw error;
  }
};

// ============ SETUP WIZARD ============

export interface SetupStatus {
  setupCompleted: boolean;
  completedAt?: string;
}

export interface SetupServiceInput {
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
      action?: {
        type: 'webhook';
        label: string;
        url: string;
        method: 'GET' | 'POST' | 'PUT' | 'DELETE';
        body?: Record<string, unknown>;
        confirmMessage?: string;
      };
    }>;
  };
}

export interface SetupCompleteInput {
  aiApiKey?: string;
  services: SetupServiceInput[];
  teamEmails: string[];
  createRotation: boolean;
}

export interface SetupCompleteResult {
  message: string;
  created: {
    services: number;
    runbooks: number;
    invitations: number;
    schedule?: string;
  };
}

/**
 * Get current setup status for the organization
 */
export const getSetupStatus = async (): Promise<SetupStatus> => {
  try {
    const response = await apiClient.get<SetupStatus>('/v1/setup/status');
    return response.data;
  } catch (error) {
    console.error('Error fetching setup status:', error);
    throw error;
  }
};

/**
 * Complete the setup wizard
 */
export const completeSetup = async (data: SetupCompleteInput): Promise<SetupCompleteResult> => {
  try {
    const response = await apiClient.post<SetupCompleteResult>('/v1/setup/complete', data);
    return response.data;
  } catch (error) {
    console.error('Error completing setup:', error);
    throw error;
  }
};

// ============ TEAMS ============

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

export interface Team {
  id: string;
  name: string;
  description?: string;
  slug: string;
  memberCount: number;
  members: TeamMember[];
  resources?: {
    schedules: Array<{ id: string; name: string }>;
    escalationPolicies: Array<{ id: string; name: string }>;
    services: Array<{ id: string; name: string }>;
  };
  createdAt: string;
  updatedAt: string;
}

/**
 * Get all teams in the organization
 */
export const getTeams = async (): Promise<Team[]> => {
  try {
    const response = await apiClient.get('/v1/teams');
    return response.data.teams;
  } catch (error) {
    console.error('Error fetching teams:', error);
    throw error;
  }
};

/**
 * Get a specific team with details
 */
export const getTeam = async (teamId: string): Promise<Team> => {
  try {
    const response = await apiClient.get(`/v1/teams/${teamId}`);
    return response.data.team;
  } catch (error) {
    console.error('Error fetching team:', error);
    throw error;
  }
};

/**
 * Create a new team (admin only)
 */
export const createTeam = async (data: {
  name: string;
  description?: string;
}): Promise<Team> => {
  try {
    const response = await apiClient.post('/v1/teams', data);
    return response.data.team;
  } catch (error) {
    console.error('Error creating team:', error);
    throw error;
  }
};

/**
 * Update a team (admin only)
 */
export const updateTeam = async (
  teamId: string,
  data: { name?: string; description?: string }
): Promise<Team> => {
  try {
    const response = await apiClient.put(`/v1/teams/${teamId}`, data);
    return response.data.team;
  } catch (error) {
    console.error('Error updating team:', error);
    throw error;
  }
};

/**
 * Delete a team (admin only)
 */
export const deleteTeam = async (teamId: string): Promise<void> => {
  try {
    await apiClient.delete(`/v1/teams/${teamId}`);
  } catch (error) {
    console.error('Error deleting team:', error);
    throw error;
  }
};

/**
 * Add a member to a team (admin only)
 */
export const addTeamMember = async (
  teamId: string,
  userId: string,
  role: 'manager' | 'member' = 'member'
): Promise<TeamMember> => {
  try {
    const response = await apiClient.post(`/v1/teams/${teamId}/members`, { userId, role });
    return response.data.member;
  } catch (error) {
    console.error('Error adding team member:', error);
    throw error;
  }
};

/**
 * Update a team member's role (admin only)
 */
export const updateTeamMemberRole = async (
  teamId: string,
  userId: string,
  role: 'manager' | 'member'
): Promise<TeamMember> => {
  try {
    const response = await apiClient.put(`/v1/teams/${teamId}/members/${userId}`, { role });
    return response.data.member;
  } catch (error) {
    console.error('Error updating team member role:', error);
    throw error;
  }
};

/**
 * Remove a member from a team (admin only)
 */
export const removeTeamMember = async (teamId: string, userId: string): Promise<void> => {
  try {
    await apiClient.delete(`/v1/teams/${teamId}/members/${userId}`);
  } catch (error) {
    console.error('Error removing team member:', error);
    throw error;
  }
};

// ============ ROUTING RULES ============

export interface RoutingRuleCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'starts_with' | 'ends_with' | 'regex' | 'in' | 'not_in' | 'exists' | 'not_exists';
  value?: string | string[];
}

export interface RoutingRule {
  id: string;
  name: string;
  description?: string;
  ruleOrder: number;
  enabled: boolean;
  matchType: 'all' | 'any';
  conditions: RoutingRuleCondition[];
  targetServiceId?: string;
  targetService?: {
    id: string;
    name: string;
  } | null;
  setSeverity?: 'info' | 'warning' | 'error' | 'critical';
  createdBy?: {
    id: string;
    fullName: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Get all routing rules
 */
export const getRoutingRules = async (): Promise<RoutingRule[]> => {
  try {
    const response = await apiClient.get('/v1/routing-rules');
    return response.data.rules;
  } catch (error) {
    console.error('Error fetching routing rules:', error);
    throw error;
  }
};

/**
 * Get a specific routing rule
 */
export const getRoutingRule = async (ruleId: string): Promise<RoutingRule> => {
  try {
    const response = await apiClient.get(`/v1/routing-rules/${ruleId}`);
    return response.data.rule;
  } catch (error) {
    console.error('Error fetching routing rule:', error);
    throw error;
  }
};

/**
 * Create a new routing rule
 */
export const createRoutingRule = async (data: {
  name: string;
  description?: string;
  matchType?: 'all' | 'any';
  conditions?: RoutingRuleCondition[];
  targetServiceId?: string;
  setSeverity?: 'info' | 'warning' | 'error' | 'critical';
  enabled?: boolean;
}): Promise<RoutingRule> => {
  try {
    const response = await apiClient.post('/v1/routing-rules', data);
    return response.data.rule;
  } catch (error) {
    console.error('Error creating routing rule:', error);
    throw error;
  }
};

/**
 * Update a routing rule
 */
export const updateRoutingRule = async (
  ruleId: string,
  data: {
    name?: string;
    description?: string;
    matchType?: 'all' | 'any';
    conditions?: RoutingRuleCondition[];
    targetServiceId?: string | null;
    setSeverity?: 'info' | 'warning' | 'error' | 'critical' | null;
    enabled?: boolean;
    ruleOrder?: number;
  }
): Promise<RoutingRule> => {
  try {
    const response = await apiClient.put(`/v1/routing-rules/${ruleId}`, data);
    return response.data.rule;
  } catch (error) {
    console.error('Error updating routing rule:', error);
    throw error;
  }
};

/**
 * Delete a routing rule
 */
export const deleteRoutingRule = async (ruleId: string): Promise<void> => {
  try {
    await apiClient.delete(`/v1/routing-rules/${ruleId}`);
  } catch (error) {
    console.error('Error deleting routing rule:', error);
    throw error;
  }
};

/**
 * Test a routing rule against a sample payload
 */
export const testRoutingRule = async (
  ruleId: string,
  payload: Record<string, unknown>
): Promise<{ matches: boolean; result: any }> => {
  try {
    const response = await apiClient.post(`/v1/routing-rules/${ruleId}/test`, { payload });
    return response.data;
  } catch (error) {
    console.error('Error testing routing rule:', error);
    throw error;
  }
};

// ============ INTEGRATIONS ============

export type IntegrationType = 'slack' | 'teams' | 'jira' | 'servicenow' | 'webhook' | 'pagerduty_import';
export type IntegrationStatus = 'pending' | 'active' | 'error' | 'disabled';

export interface Integration {
  id: string;
  type: IntegrationType;
  name: string;
  status: IntegrationStatus;
  config?: Record<string, unknown>;
  features?: {
    incident_sync?: boolean;
    bidirectional?: boolean;
    auto_create_channel?: boolean;
    auto_resolve?: boolean;
    sync_comments?: boolean;
    sync_status?: boolean;
  };
  // Slack-specific
  slackWorkspaceId?: string;
  slackWorkspaceName?: string;
  slackDefaultChannelId?: string;
  // Jira-specific
  jiraSiteUrl?: string;
  jiraProjectKey?: string;
  jiraIssueType?: string;
  // Webhook
  webhookUrl?: string;
  // Error info
  lastError?: string;
  lastErrorAt?: string;
  errorCount?: number;
  // Timestamps
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

/**
 * Get all integrations
 */
export const getIntegrations = async (type?: IntegrationType): Promise<Integration[]> => {
  try {
    const params = type ? { type } : {};
    const response = await apiClient.get('/v1/integrations', { params });
    return response.data.integrations;
  } catch (error) {
    console.error('Error fetching integrations:', error);
    throw error;
  }
};

/**
 * Get a specific integration
 */
export const getIntegration = async (integrationId: string): Promise<Integration> => {
  try {
    const response = await apiClient.get(`/v1/integrations/${integrationId}`);
    return response.data.integration;
  } catch (error) {
    console.error('Error fetching integration:', error);
    throw error;
  }
};

/**
 * Create a new integration
 */
export const createIntegration = async (data: {
  type: IntegrationType;
  name: string;
  config?: Record<string, unknown>;
  features?: Integration['features'];
}): Promise<Integration> => {
  try {
    const response = await apiClient.post('/v1/integrations', data);
    return response.data.integration;
  } catch (error) {
    console.error('Error creating integration:', error);
    throw error;
  }
};

/**
 * Update an integration
 */
export const updateIntegration = async (
  integrationId: string,
  data: {
    name?: string;
    config?: Record<string, unknown>;
    features?: Integration['features'];
    status?: 'active' | 'disabled';
  }
): Promise<Integration> => {
  try {
    const response = await apiClient.put(`/v1/integrations/${integrationId}`, data);
    return response.data.integration;
  } catch (error) {
    console.error('Error updating integration:', error);
    throw error;
  }
};

/**
 * Delete an integration
 */
export const deleteIntegration = async (integrationId: string): Promise<void> => {
  try {
    await apiClient.delete(`/v1/integrations/${integrationId}`);
  } catch (error) {
    console.error('Error deleting integration:', error);
    throw error;
  }
};

/**
 * Get integration events/activity
 */
export const getIntegrationEvents = async (
  integrationId: string,
  limit: number = 50
): Promise<IntegrationEvent[]> => {
  try {
    const response = await apiClient.get(`/v1/integrations/${integrationId}/events`, {
      params: { limit },
    });
    return response.data.events;
  } catch (error) {
    console.error('Error fetching integration events:', error);
    throw error;
  }
};

/**
 * Get services linked to an integration
 */
export const getIntegrationServices = async (
  integrationId: string
): Promise<Array<{ id: string; name: string; status: string }>> => {
  try {
    const response = await apiClient.get(`/v1/integrations/${integrationId}/services`);
    return response.data.services;
  } catch (error) {
    console.error('Error fetching integration services:', error);
    throw error;
  }
};

/**
 * Link a service to an integration
 */
export const linkServiceToIntegration = async (
  integrationId: string,
  serviceId: string,
  configOverrides?: Record<string, unknown>
): Promise<void> => {
  try {
    await apiClient.post(`/v1/integrations/${integrationId}/services/${serviceId}`, {
      config_overrides: configOverrides,
    });
  } catch (error) {
    console.error('Error linking service to integration:', error);
    throw error;
  }
};

/**
 * Unlink a service from an integration
 */
export const unlinkServiceFromIntegration = async (
  integrationId: string,
  serviceId: string
): Promise<void> => {
  try {
    await apiClient.delete(`/v1/integrations/${integrationId}/services/${serviceId}`);
  } catch (error) {
    console.error('Error unlinking service from integration:', error);
    throw error;
  }
};

/**
 * Test a Slack integration
 */
export const testSlackIntegration = async (
  integrationId: string,
  channelId: string
): Promise<{ message: string; messageTs?: string }> => {
  try {
    const response = await apiClient.post(`/v1/integrations/${integrationId}/slack/test`, {
      channel_id: channelId,
    });
    return response.data;
  } catch (error) {
    console.error('Error testing Slack integration:', error);
    throw error;
  }
};

/**
 * Get available Slack channels
 */
export const getSlackChannels = async (
  integrationId: string
): Promise<Array<{ id: string; name: string }>> => {
  try {
    const response = await apiClient.get(`/v1/integrations/${integrationId}/slack/channels`);
    return response.data.channels;
  } catch (error) {
    console.error('Error fetching Slack channels:', error);
    throw error;
  }
};

// ============ SCHEDULE LAYERS ============

export type RotationType = 'daily' | 'weekly' | 'custom';

export interface LayerRestrictions {
  type: 'weekly';
  intervals: Array<{
    startDay: number;
    startTime: string;
    endDay: number;
    endTime: string;
  }>;
}

export interface ScheduleLayerMember {
  id: string;
  userId: string;
  position: number;
  user: {
    id: string;
    fullName: string;
    email: string;
  } | null;
}

export interface ScheduleLayer {
  id: string;
  scheduleId: string;
  name: string;
  rotationType: RotationType;
  startDate: string;
  endDate: string | null;
  handoffTime: string;
  handoffDay: number | null;
  rotationLength: number;
  layerOrder: number;
  restrictions: LayerRestrictions | null;
  members: ScheduleLayerMember[];
  currentOncallUserId: string | null;
  createdAt: string;
}

export interface ScheduleOverride {
  id: string;
  scheduleId: string;
  userId: string;
  user: {
    id: string;
    fullName: string;
    email: string;
  } | null;
  startTime: string;
  endTime: string;
  reason: string | null;
  createdAt: string;
}

/**
 * Get all layers for a schedule
 */
export const getScheduleLayers = async (scheduleId: string): Promise<ScheduleLayer[]> => {
  try {
    const response = await apiClient.get(`/v1/schedules/${scheduleId}/layers`);
    return response.data.layers;
  } catch (error) {
    console.error('Error fetching schedule layers:', error);
    throw error;
  }
};

/**
 * Create a new layer for a schedule
 */
export const createScheduleLayer = async (
  scheduleId: string,
  data: {
    name: string;
    rotationType?: RotationType;
    startDate: string;
    endDate?: string;
    handoffTime?: string;
    handoffDay?: number;
    rotationLength?: number;
    layerOrder?: number;
    restrictions?: LayerRestrictions;
    userIds?: string[];
  }
): Promise<ScheduleLayer> => {
  try {
    const response = await apiClient.post(`/v1/schedules/${scheduleId}/layers`, data);
    return response.data.layer;
  } catch (error) {
    console.error('Error creating schedule layer:', error);
    throw error;
  }
};

/**
 * Update a schedule layer
 */
export const updateScheduleLayer = async (
  scheduleId: string,
  layerId: string,
  data: {
    name?: string;
    rotationType?: RotationType;
    startDate?: string;
    endDate?: string | null;
    handoffTime?: string;
    handoffDay?: number | null;
    rotationLength?: number;
    layerOrder?: number;
    restrictions?: LayerRestrictions | null;
  }
): Promise<ScheduleLayer> => {
  try {
    const response = await apiClient.put(`/v1/schedules/${scheduleId}/layers/${layerId}`, data);
    return response.data.layer;
  } catch (error) {
    console.error('Error updating schedule layer:', error);
    throw error;
  }
};

/**
 * Delete a schedule layer
 */
export const deleteScheduleLayer = async (scheduleId: string, layerId: string): Promise<void> => {
  try {
    await apiClient.delete(`/v1/schedules/${scheduleId}/layers/${layerId}`);
  } catch (error) {
    console.error('Error deleting schedule layer:', error);
    throw error;
  }
};

/**
 * Set members for a schedule layer
 */
export const setScheduleLayerMembers = async (
  scheduleId: string,
  layerId: string,
  userIds: string[]
): Promise<ScheduleLayerMember[]> => {
  try {
    const response = await apiClient.put(`/v1/schedules/${scheduleId}/layers/${layerId}/members`, {
      userIds,
    });
    return response.data.members;
  } catch (error) {
    console.error('Error setting layer members:', error);
    throw error;
  }
};

/**
 * Get schedule overrides
 */
export const getScheduleOverrides = async (scheduleId: string): Promise<{
  active: ScheduleOverride[];
  upcoming: ScheduleOverride[];
  recent: ScheduleOverride[];
}> => {
  try {
    const response = await apiClient.get(`/v1/schedules/${scheduleId}/overrides`);
    return response.data;
  } catch (error) {
    console.error('Error fetching schedule overrides:', error);
    throw error;
  }
};

/**
 * Create a schedule layer override (with time range)
 */
export const createLayerOverride = async (
  scheduleId: string,
  data: {
    userId: string;
    startTime: string;
    endTime: string;
    reason?: string;
  }
): Promise<ScheduleOverride> => {
  try {
    const response = await apiClient.post(`/v1/schedules/${scheduleId}/overrides`, data);
    return response.data.override;
  } catch (error) {
    console.error('Error creating schedule override:', error);
    throw error;
  }
};

/**
 * Update a schedule layer override
 */
export const updateLayerOverride = async (
  scheduleId: string,
  overrideId: string,
  data: {
    userId?: string;
    startTime?: string;
    endTime?: string;
    reason?: string;
  }
): Promise<ScheduleOverride> => {
  try {
    const response = await apiClient.put(`/v1/schedules/${scheduleId}/overrides/${overrideId}`, data);
    return response.data.override;
  } catch (error) {
    console.error('Error updating schedule override:', error);
    throw error;
  }
};

/**
 * Delete a schedule layer override
 */
export const deleteLayerOverride = async (scheduleId: string, overrideId: string): Promise<void> => {
  try {
    await apiClient.delete(`/v1/schedules/${scheduleId}/overrides/${overrideId}`);
  } catch (error) {
    console.error('Error deleting schedule override:', error);
    throw error;
  }
};

// ============ UPCOMING SHIFTS ============

export interface UpcomingShift {
  scheduleId: string;
  scheduleName: string;
  serviceId: string;
  serviceName: string;
  startTime: string;
  endTime: string;
  isOverride: boolean;
}

/**
 * Get current user's upcoming on-call shifts
 * Returns shifts for the next 30 days
 */
export const getUpcomingShifts = async (): Promise<UpcomingShift[]> => {
  try {
    // Try to fetch from dedicated endpoint first
    const response = await apiClient.get('/v1/schedules/my-shifts');
    return response.data.shifts || [];
  } catch (error: any) {
    // If endpoint doesn't exist yet, compute from schedules
    if (error.response?.status === 404) {
      console.log('Upcoming shifts endpoint not available, computing locally');
      return computeUpcomingShiftsLocally();
    }
    console.error('Error fetching upcoming shifts:', error);
    throw error;
  }
};

/**
 * Compute upcoming shifts locally from schedule data
 * This is a fallback when the server endpoint isn't available
 */
const computeUpcomingShiftsLocally = async (): Promise<UpcomingShift[]> => {
  try {
    const [schedules, profile] = await Promise.all([
      getSchedules(),
      getUserProfile().catch(() => null),
    ]);

    if (!profile) return [];

    const shifts: UpcomingShift[] = [];
    const now = new Date();
    const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    for (const schedule of schedules) {
      try {
        const layers = await getScheduleLayers(schedule.id);

        for (const layer of layers) {
          // Check if current user is in this layer
          const userMember = layer.members.find(m => m.userId === profile.id);
          if (!userMember) continue;

          // Calculate upcoming shifts based on rotation
          const userPosition = userMember.position;
          const totalMembers = layer.members.length;

          if (totalMembers === 0) continue;

          // Parse handoff time
          const handoffParts = layer.handoffTime.split(':');
          const handoffHour = parseInt(handoffParts[0]) || 9;
          const handoffMinute = parseInt(handoffParts[1]) || 0;

          // Calculate shift duration based on rotation type
          let shiftDurationMs: number;
          switch (layer.rotationType) {
            case 'daily':
              shiftDurationMs = 24 * 60 * 60 * 1000;
              break;
            case 'weekly':
              shiftDurationMs = 7 * 24 * 60 * 60 * 1000;
              break;
            case 'custom':
              shiftDurationMs = (layer.rotationLength || 1) * 24 * 60 * 60 * 1000;
              break;
            default:
              shiftDurationMs = 24 * 60 * 60 * 1000;
          }

          // Rotation cycle length
          const cycleLength = shiftDurationMs * totalMembers;

          // Find start of rotation
          const rotationStart = new Date(layer.startDate);
          rotationStart.setHours(handoffHour, handoffMinute, 0, 0);

          // Calculate when user's shifts occur
          const userOffsetMs = userPosition * shiftDurationMs;

          // Find the first shift that ends after now
          let currentCycleStart = new Date(rotationStart.getTime());
          while (currentCycleStart.getTime() + cycleLength < now.getTime()) {
            currentCycleStart = new Date(currentCycleStart.getTime() + cycleLength);
          }

          // Generate shifts for next 30 days
          let checkTime = currentCycleStart.getTime();
          while (checkTime < thirtyDaysLater.getTime()) {
            const shiftStart = new Date(checkTime + userOffsetMs);
            const shiftEnd = new Date(shiftStart.getTime() + shiftDurationMs);

            // Only include future shifts or currently active shifts
            if (shiftEnd.getTime() > now.getTime()) {
              shifts.push({
                scheduleId: schedule.id,
                scheduleName: schedule.name,
                serviceId: '', // Would need service association
                serviceName: layer.name || schedule.name,
                startTime: shiftStart.toISOString(),
                endTime: shiftEnd.toISOString(),
                isOverride: false,
              });
            }

            checkTime += cycleLength;
          }
        }
      } catch (err) {
        console.warn(`Failed to compute shifts for schedule ${schedule.id}:`, err);
      }
    }

    // Sort by start time
    shifts.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

    // Return first 10 shifts
    return shifts.slice(0, 10);
  } catch (error) {
    console.error('Error computing upcoming shifts locally:', error);
    return [];
  }
};

// ============ USER CONTACT METHODS ============

export type ContactMethodType = 'email' | 'sms' | 'phone' | 'push';

export interface UserContactMethod {
  id: string;
  type: ContactMethodType;
  address: string;
  label: string | null;
  verified: boolean;
  isDefault: boolean;
  createdAt: string;
}

/**
 * Get current user's contact methods
 */
export const getContactMethods = async (): Promise<UserContactMethod[]> => {
  try {
    const response = await apiClient.get('/v1/users/me/contact-methods');
    return response.data.contactMethods;
  } catch (error) {
    console.error('Error fetching contact methods:', error);
    throw error;
  }
};

/**
 * Add a new contact method
 */
export const addContactMethod = async (data: {
  type: ContactMethodType;
  address: string;
  label?: string;
}): Promise<UserContactMethod> => {
  try {
    const response = await apiClient.post('/v1/users/me/contact-methods', data);
    return response.data.contactMethod;
  } catch (error) {
    console.error('Error adding contact method:', error);
    throw error;
  }
};

/**
 * Update a contact method
 */
export const updateContactMethod = async (
  contactMethodId: string,
  data: {
    label?: string;
    isDefault?: boolean;
  }
): Promise<UserContactMethod> => {
  try {
    const response = await apiClient.put(`/v1/users/me/contact-methods/${contactMethodId}`, data);
    return response.data.contactMethod;
  } catch (error) {
    console.error('Error updating contact method:', error);
    throw error;
  }
};

/**
 * Delete a contact method
 */
export const deleteContactMethod = async (contactMethodId: string): Promise<void> => {
  try {
    await apiClient.delete(`/v1/users/me/contact-methods/${contactMethodId}`);
  } catch (error) {
    console.error('Error deleting contact method:', error);
    throw error;
  }
};

/**
 * Send verification code for a contact method
 */
export const sendVerificationCode = async (contactMethodId: string): Promise<{ sentAt: string }> => {
  try {
    const response = await apiClient.post(`/v1/users/me/contact-methods/${contactMethodId}/verify`);
    return response.data;
  } catch (error) {
    console.error('Error sending verification code:', error);
    throw error;
  }
};

/**
 * Verify a contact method with a code
 */
export const verifyContactMethod = async (
  contactMethodId: string,
  code: string
): Promise<{ verified: boolean }> => {
  try {
    const response = await apiClient.post(`/v1/users/me/contact-methods/${contactMethodId}/verify`, {
      code,
    });
    return response.data;
  } catch (error) {
    console.error('Error verifying contact method:', error);
    throw error;
  }
};

// ============ USER NOTIFICATION RULES ============

export type NotificationUrgency = 'high' | 'low' | 'any';

export interface UserNotificationRule {
  id: string;
  contactMethodId: string;
  contactMethod: {
    id: string;
    type: ContactMethodType;
    address: string;
    label: string | null;
  } | null;
  urgency: NotificationUrgency;
  startDelayMinutes: number;
  ruleOrder: number;
  enabled: boolean;
  createdAt: string;
}

/**
 * Get current user's notification rules
 */
export const getNotificationRules = async (): Promise<UserNotificationRule[]> => {
  try {
    const response = await apiClient.get('/v1/users/me/notification-rules');
    return response.data.notificationRules;
  } catch (error) {
    console.error('Error fetching notification rules:', error);
    throw error;
  }
};

/**
 * Create a notification rule
 */
export const createNotificationRule = async (data: {
  contactMethodId: string;
  urgency: NotificationUrgency;
  startDelayMinutes?: number;
}): Promise<UserNotificationRule> => {
  try {
    const response = await apiClient.post('/v1/users/me/notification-rules', data);
    return response.data.notificationRule;
  } catch (error) {
    console.error('Error creating notification rule:', error);
    throw error;
  }
};

/**
 * Update a notification rule
 */
export const updateNotificationRule = async (
  ruleId: string,
  data: {
    urgency?: NotificationUrgency;
    startDelayMinutes?: number;
    enabled?: boolean;
  }
): Promise<UserNotificationRule> => {
  try {
    const response = await apiClient.put(`/v1/users/me/notification-rules/${ruleId}`, data);
    return response.data.notificationRule;
  } catch (error) {
    console.error('Error updating notification rule:', error);
    throw error;
  }
};

/**
 * Delete a notification rule
 */
export const deleteNotificationRule = async (ruleId: string): Promise<void> => {
  try {
    await apiClient.delete(`/v1/users/me/notification-rules/${ruleId}`);
  } catch (error) {
    console.error('Error deleting notification rule:', error);
    throw error;
  }
};

// ============ ALERT GROUPING RULES ============

export type GroupingType = 'intelligent' | 'time' | 'content' | 'disabled';

export interface AlertGroupingRule {
  id: string;
  serviceId: string;
  groupingType: GroupingType;
  timeWindowMinutes: number;
  contentFields: string[];
  dedupKeyTemplate: string | null;
  maxAlertsPerIncident: number;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AlertGroupingDefaults {
  groupingType: GroupingType;
  timeWindowMinutes: number;
  contentFields: string[];
  maxAlertsPerIncident: number;
}

/**
 * Get alert grouping rule for a service
 */
export const getAlertGroupingRule = async (serviceId: string): Promise<{
  groupingRule: AlertGroupingRule | null;
  defaults: AlertGroupingDefaults;
}> => {
  try {
    const response = await apiClient.get(`/v1/services/${serviceId}/grouping-rule`);
    return response.data;
  } catch (error) {
    console.error('Error fetching alert grouping rule:', error);
    throw error;
  }
};

/**
 * Update alert grouping rule for a service
 */
export const updateAlertGroupingRule = async (
  serviceId: string,
  data: {
    groupingType?: GroupingType;
    timeWindowMinutes?: number;
    contentFields?: string[];
    dedupKeyTemplate?: string | null;
    maxAlertsPerIncident?: number;
  }
): Promise<AlertGroupingRule> => {
  try {
    const response = await apiClient.put(`/v1/services/${serviceId}/grouping-rule`, data);
    return response.data.groupingRule;
  } catch (error) {
    console.error('Error updating alert grouping rule:', error);
    throw error;
  }
};

/**
 * Delete alert grouping rule for a service (revert to defaults)
 */
export const deleteAlertGroupingRule = async (serviceId: string): Promise<void> => {
  try {
    await apiClient.delete(`/v1/services/${serviceId}/grouping-rule`);
  } catch (error) {
    console.error('Error deleting alert grouping rule:', error);
    throw error;
  }
};
