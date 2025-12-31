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
 * Resolve an incident
 */
export const resolveIncident = async (incidentId: string, note?: string): Promise<{ incident: Incident; message: string }> => {
  try {
    const response = await apiClient.put(`/v1/incidents/${incidentId}/resolve`, note ? { note } : undefined);
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
 * Snooze an incident (server-side)
 */
export const snoozeIncident = async (
  incidentId: string,
  durationMinutes: number,
  reason?: string
): Promise<{ incident: Incident; message: string }> => {
  try {
    const response = await apiClient.post(`/v1/incidents/${incidentId}/snooze`, {
      durationMinutes,
      reason,
    });
    return response.data;
  } catch (error) {
    console.error('Error snoozing incident:', error);
    throw error;
  }
};

/**
 * Cancel snooze on an incident
 */
export const unsnoozeIncident = async (incidentId: string): Promise<{ incident: Incident; message: string }> => {
  try {
    const response = await apiClient.delete(`/v1/incidents/${incidentId}/snooze`);
    return response.data;
  } catch (error) {
    console.error('Error unsnoozing incident:', error);
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

export interface EscalationStep {
  id: string;
  escalationLevel: number;
  delayMinutes: number;
  targetType: 'user' | 'schedule';
  targetId: string;
  targetName?: string;
}

export interface EscalationPolicy {
  id: string;
  name: string;
  description?: string;
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
