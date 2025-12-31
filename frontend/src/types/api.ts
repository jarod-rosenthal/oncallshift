// API Response Types matching backend

export interface DayHours {
  available: boolean;
  start: string; // HH:mm format
  end: string; // HH:mm format
}

export interface WeeklyHours {
  monday: DayHours;
  tuesday: DayHours;
  wednesday: DayHours;
  thursday: DayHours;
  friday: DayHours;
  saturday: DayHours;
  sunday: DayHours;
}

export interface BlackoutDate {
  start: string; // ISO date
  end: string; // ISO date
  reason?: string;
}

export interface UserAvailability {
  timezone: string;
  weeklyHours: WeeklyHours;
  blackoutDates: BlackoutDate[];
}

export interface NotificationChannel {
  enabled: boolean;
  types: ('triggered' | 'acknowledged' | 'resolved')[];
}

export interface NotificationPreferences {
  email: NotificationChannel;
  sms: NotificationChannel;
  push: NotificationChannel;
}

export interface ProfileSettings {
  displayName?: string | null;
}

export interface UserSettings {
  availability?: UserAvailability;
  notificationPreferences?: NotificationPreferences;
  profile?: ProfileSettings;
  profileTimezone?: string;
}

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: 'admin' | 'member';
  phoneNumber: string | null;
  status?: 'active' | 'inactive';
  settings?: UserSettings;
  hasAvailability?: boolean;
  availability?: UserAvailability | null;
  organization?: {
    id: string;
    name: string;
    plan?: string | null;
  };
  createdAt: string;
}

export interface UpdateProfileRequest {
  fullName?: string;
  phoneNumber?: string | null;
  displayName?: string | null;
  timezone?: string;
  notificationPreferences?: Partial<NotificationPreferences>;
}

export interface UpdateProfileResponse {
  message: string;
  user: User;
}

export interface Organization {
  id: string;
  name: string;
  plan: string;
  status: string;
}

export interface Schedule {
  id: string;
  name: string;
  description: string | null;
  type: 'manual' | 'daily' | 'weekly';
  timezone: string;
  currentOncallUserId: string | null;
  isOverride: boolean;
  overrideUntil: string | null;
  rotationConfig: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
}

export interface Service {
  id: string;
  name: string;
  description: string | null;
  apiKey: string;
  status: 'active' | 'inactive' | 'maintenance';
  schedule: {
    id: string;
    name: string;
  } | null;
  escalationPolicy: {
    id: string;
    name: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface InviteUserRequest {
  email: string;
  fullName: string;
  role?: 'admin' | 'member';
}

export interface CreateServiceRequest {
  name: string;
  description?: string;
  scheduleId?: string;
  escalationPolicyId?: string;
}

export interface UpdateServiceRequest {
  name?: string;
  description?: string;
  scheduleId?: string;
  escalationPolicyId?: string;
  status?: 'active' | 'inactive' | 'maintenance';
}

export interface IncidentUser {
  id: string;
  fullName: string;
  email: string;
}

export interface Incident {
  id: string;
  incidentNumber: number;
  summary: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  state: 'triggered' | 'acknowledged' | 'resolved';
  triggeredAt: string;
  acknowledgedAt: string | null;
  acknowledgedBy: IncidentUser | null;
  resolvedAt: string | null;
  resolvedBy: IncidentUser | null;
  assignedAt: string | null;
  assignedTo: IncidentUser | null;
  snoozedUntil: string | null;
  snoozedBy: IncidentUser | null;
  isSnoozed: boolean;
  currentEscalationStep: number;
  details: Record<string, any> | null;
  service: {
    id: string;
    name: string;
  };
}

export interface AuthTokens {
  accessToken: string;
  idToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  fullName: string;
  organizationName: string;
  phoneNumber?: string;
}

export interface LoginResponse {
  message: string;
  tokens: AuthTokens;
}

export interface RegisterResponse {
  message: string;
  user: User;
  organization: Organization;
}

export interface OnCallInfo {
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
  overrideUntil: string | null;
}

export interface ScheduleMember {
  id: string;
  userId: string;
  position: number;
  user: {
    id: string;
    email: string;
    fullName: string;
    hasAvailability: boolean;
  } | null;
  createdAt: string;
}

// Escalation Status
export interface EscalationTarget {
  userId: string;
  name: string;
  email: string;
}

export interface EscalationStatus {
  policyName: string | null;
  currentStep: number;
  totalSteps: number;
  stepStartedAt: string | null;
  timeoutAt: string | null;
  currentStepTimeoutSeconds: number | null;
  currentTargets: EscalationTarget[];
  isEscalating: boolean;
}

// Incident Timeline Event
export interface IncidentEvent {
  id: string;
  type: 'alert' | 'acknowledge' | 'resolve' | 'escalate' | 'snooze' | 'unsnooze' | 'reassign' | 'note';
  message: string;
  payload: Record<string, any> | null;
  actor: {
    id: string;
    fullName: string;
    email: string;
  } | null;
  createdAt: string;
}

// Incident Detail Response (extended)
export interface IncidentDetailResponse {
  incident: Incident;
  escalation: EscalationStatus | null;
}

// Incident Timeline Response
export interface IncidentTimelineResponse {
  events: IncidentEvent[];
}

// Runbook Types
export interface RunbookStepAction {
  type: 'webhook';
  label: string;
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: Record<string, unknown>;
  confirmMessage?: string;
}

export interface RunbookStep {
  id: string;
  order: number;
  title: string;
  description: string;
  isOptional: boolean;
  estimatedMinutes?: number;
  action?: RunbookStepAction;
}

export interface Runbook {
  id: string;
  serviceId: string;
  service: {
    id: string;
    name: string;
  } | null;
  title: string;
  description: string | null;
  steps: RunbookStep[];
  severity: string[];
  tags: string[];
  externalUrl: string | null;
  createdBy: {
    id: string;
    fullName: string;
    email: string;
  } | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRunbookRequest {
  serviceId: string;
  title: string;
  description?: string;
  steps: RunbookStep[];
  severity?: string[];
  tags?: string[];
  externalUrl?: string;
}

export interface UpdateRunbookRequest {
  title?: string;
  description?: string;
  steps?: RunbookStep[];
  severity?: string[];
  tags?: string[];
  externalUrl?: string | null;
}
