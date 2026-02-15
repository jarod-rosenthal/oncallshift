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

export interface DNDSettings {
  enabled: boolean;
  startTime: string | null;
  endTime: string | null;
  timezone: string | null;
}

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: 'admin' | 'member';
  phoneNumber: string | null;
  profilePictureUrl?: string | null;
  status?: 'active' | 'inactive';
  settings?: UserSettings;
  hasAvailability?: boolean;
  availability?: UserAvailability | null;
  // DND settings stored as direct user columns
  dnd?: DNDSettings;
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
  // DND settings
  dndEnabled?: boolean;
  dndStartTime?: string;
  dndEndTime?: string;
  dndTimezone?: string;
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

export type ServiceUrgency = 'high' | 'low' | 'dynamic';

export interface SupportHours {
  enabled: boolean;
  timezone: string;
  days: number[];  // 0 = Sunday, 6 = Saturday
  startTime: string;  // HH:mm format
  endTime: string;    // HH:mm format
}

export interface Service {
  id: string;
  name: string;
  description: string | null;
  apiKey: string;
  status: 'active' | 'inactive' | 'maintenance';
  urgency: ServiceUrgency;
  supportHours: SupportHours | null;
  ackTimeoutSeconds: number | null;
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
  urgency?: ServiceUrgency;
  supportHours?: SupportHours;
  ackTimeoutSeconds?: number;
}

export interface UpdateServiceRequest {
  name?: string;
  description?: string;
  scheduleId?: string;
  escalationPolicyId?: string;
  status?: 'active' | 'inactive' | 'maintenance';
  urgency?: ServiceUrgency;
  supportHours?: SupportHours | null;
  ackTimeoutSeconds?: number | null;
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
  urgency?: 'high' | 'low';
  triggeredAt: string;
  acknowledgedAt: string | null;
  acknowledgedBy: IncidentUser | null;
  resolvedAt: string | null;
  resolvedBy: IncidentUser | null;
  assignedAt: string | null;
  assignedTo: IncidentUser | null;
  currentEscalationStep: number;
  details: Record<string, any> | null;
  snoozedUntil?: string | null;
  isSnoozed?: boolean;
  conferenceBridgeUrl?: string | null;
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

// Schedule Override
export interface ScheduleOverride {
  id: string;
  scheduleId: string;
  userId: string;
  startTime: string;
  endTime: string;
  reason: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
  isFuture: boolean;
  hasEnded: boolean;
  durationHours: number;
  user?: {
    id: string;
    fullName: string;
    email: string;
  };
  createdByUser?: {
    id: string;
    fullName: string;
    email: string;
  };
}

export interface CreateScheduleOverrideRequest {
  userId: string;
  startTime: string;
  endTime: string;
  reason?: string;
}

export interface UpdateScheduleOverrideRequest {
  startTime?: string;
  endTime?: string;
  reason?: string;
}

// Maintenance Window
export interface MaintenanceWindow {
  id: string;
  serviceId: string;
  startTime: string;
  endTime: string;
  description: string | null;
  suppressAlerts: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
  isFuture: boolean;
  hasEnded: boolean;
  remainingTime: number;
  duration: string;
  service?: {
    id: string;
    name: string;
  };
}

export interface CreateMaintenanceWindowRequest {
  startTime: string;
  endTime: string;
  description?: string;
  suppressAlerts?: boolean;
}

export interface UpdateMaintenanceWindowRequest {
  startTime?: string;
  endTime?: string;
  description?: string;
  suppressAlerts?: boolean;
}

// Escalation Status
export interface EscalationTarget {
  userId: string;
  name: string;
  email: string;
}

export interface EscalationStepInfo {
  position: number;
  status: 'completed' | 'active' | 'pending';
  targetDescription: string;
  delayMinutes: number;
}

export interface EscalationStatus {
  policyName: string | null;
  policyId: string | null;
  currentStep: number;
  totalSteps: number;
  stepStartedAt: string | null;
  timeoutAt: string | null;
  currentStepTimeoutSeconds: number | null;
  currentTargets: EscalationTarget[];
  nextTargets: EscalationTarget[] | null;
  steps: EscalationStepInfo[];
  loopsRemaining: number | null;
  repeatEnabled: boolean;
  isEscalating: boolean;
}

// Incident Timeline Event
export interface IncidentEvent {
  id: string;
  type: 'alert' | 'acknowledge' | 'resolve' | 'escalate' | 'reassign' | 'note';
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

export type StepType = 'manual' | 'automated';
export type AutomationMode = 'server_sandbox' | 'claude_code_api' | 'hybrid';
export type ScriptLanguage = 'bash' | 'python' | 'javascript' | 'natural_language';

export interface ScriptDefinition {
  language: ScriptLanguage;
  code: string;
  naturalLanguageDescription?: string;
  generatedAt?: string;
  validatedAt?: string;
  version: number;
}

export interface StepAutomation {
  mode: AutomationMode;
  script?: ScriptDefinition;
  timeout: number;
  requiresApproval: boolean;
  idempotencyKey?: string;
  credentialIds?: string[];
}

export interface RunbookStep {
  id: string;
  order: number;
  title: string;
  description: string;
  isOptional: boolean;
  estimatedMinutes?: number;
  type?: StepType;
  automation?: StepAutomation;
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

// Schedule Layer Types
export type RotationType = 'daily' | 'weekly' | 'custom';

export interface LayerRestrictionInterval {
  startDay: number; // 0=Sunday
  startTime: string; // "09:00"
  endDay: number;
  endTime: string; // "17:00"
}

export interface LayerRestrictions {
  type: 'weekly';
  intervals: LayerRestrictionInterval[];
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
  updatedAt: string;
}

export interface CreateScheduleLayerRequest {
  name: string;
  rotationType: RotationType;
  startDate: string;
  endDate?: string;
  handoffTime?: string;
  handoffDay?: number;
  rotationLength?: number;
  layerOrder?: number;
  restrictions?: LayerRestrictions;
  userIds?: string[];
}

export interface UpdateScheduleLayerRequest {
  name?: string;
  rotationType?: RotationType;
  startDate?: string;
  endDate?: string | null;
  handoffTime?: string;
  handoffDay?: number;
  rotationLength?: number;
  layerOrder?: number;
  restrictions?: LayerRestrictions | null;
}

export interface RenderedScheduleEntry {
  start: string;
  end: string;
  userId: string;
  user: {
    id: string;
    fullName: string;
    email: string;
  } | null;
  source: 'layer' | 'override' | 'legacy';
  layerId?: string;
  overrideId?: string;
}

export interface RenderedScheduleResponse {
  schedule: {
    id: string;
    name: string;
    timezone: string;
  };
  since: string;
  until: string;
  entries: RenderedScheduleEntry[];
  currentOncallUserId: string | null;
}

// User Contact Method Types
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

export interface CreateContactMethodRequest {
  type: ContactMethodType;
  address: string;
  label?: string;
}

export interface UpdateContactMethodRequest {
  label?: string;
  isDefault?: boolean;
}

// User Notification Rule Types
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

export interface CreateNotificationRuleRequest {
  contactMethodId: string;
  urgency: NotificationUrgency;
  startDelayMinutes?: number;
}

export interface UpdateNotificationRuleRequest {
  urgency?: NotificationUrgency;
  startDelayMinutes?: number;
  enabled?: boolean;
}

// Alert Routing Rule Types
export type MatchType = 'all' | 'any';
export type ConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'regex'
  | 'in'
  | 'not_in'
  | 'exists'
  | 'not_exists';

export interface RoutingCondition {
  field: string;
  operator: ConditionOperator;
  value: string | string[] | boolean | null;
}

export interface AlertRoutingRule {
  id: string;
  name: string;
  description: string | null;
  ruleOrder: number;
  enabled: boolean;
  matchType: MatchType;
  conditions: RoutingCondition[];
  targetServiceId: string | null;
  targetService: {
    id: string;
    name: string;
  } | null;
  setSeverity: 'info' | 'warning' | 'error' | 'critical' | null;
  suppress: boolean;
  suspend: boolean;
  createdBy: {
    id: string;
    fullName: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRoutingRuleRequest {
  name: string;
  description?: string;
  matchType?: MatchType;
  conditions?: RoutingCondition[];
  targetServiceId?: string;
  setSeverity?: 'info' | 'warning' | 'error' | 'critical';
  enabled?: boolean;
  suppress?: boolean;
  suspend?: boolean;
}

export interface UpdateRoutingRuleRequest {
  name?: string;
  description?: string;
  matchType?: MatchType;
  conditions?: RoutingCondition[];
  targetServiceId?: string | null;
  setSeverity?: 'info' | 'warning' | 'error' | 'critical' | null;
  enabled?: boolean;
  ruleOrder?: number;
  suppress?: boolean;
  suspend?: boolean;
}

export interface RoutingRuleTestResult {
  matches: boolean;
  rule: {
    id: string;
    name: string;
    description: string;
  };
  result: {
    targetService: {
      id: string;
      name: string;
    } | null;
    setSeverity: 'info' | 'warning' | 'error' | 'critical' | null;
  } | null;
}

// Alert Grouping Types
export type GroupingType = 'intelligent' | 'time' | 'content' | 'disabled';

export interface AlertGroupingRule {
  id: string;
  serviceId: string;
  groupingType: GroupingType;
  timeWindowMinutes: number;
  contentFields: string[];
  dedupKeyTemplate: string | null;
  maxAlertsPerIncident: number;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateGroupingRuleRequest {
  groupingType?: GroupingType;
  timeWindowMinutes?: number;
  contentFields?: string[];
  dedupKeyTemplate?: string | null;
  maxAlertsPerIncident?: number;
}

// Alert Types
export type AlertStatus = 'triggered' | 'suppressed' | 'grouped';

export interface Alert {
  id: string;
  serviceId: string;
  incidentId: string | null;
  dedupKey: string | null;
  alertKey: string | null;
  summary: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  source: string | null;
  payload: Record<string, any>;
  status: AlertStatus;
  createdAt: string;
  updatedAt: string;
}

// Priority Level Types
export type PriorityUrgency = 'high' | 'low';

export interface PriorityLevel {
  id: string;
  name: string;
  description: string | null;
  color: string;
  orderValue: number;
  urgency: PriorityUrgency;
  autoEscalate: boolean;
  escalateAfterMinutes: number;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePriorityRequest {
  name: string;
  description?: string;
  color?: string;
  urgency?: PriorityUrgency;
  autoEscalate?: boolean;
  escalateAfterMinutes?: number;
  isDefault?: boolean;
}

export interface UpdatePriorityRequest {
  name?: string;
  description?: string | null;
  color?: string;
  urgency?: PriorityUrgency;
  autoEscalate?: boolean;
  escalateAfterMinutes?: number;
  isDefault?: boolean;
  orderValue?: number;
}

// Business Service Types
export type BusinessServiceStatus = 'operational' | 'degraded' | 'major_outage' | 'maintenance' | 'unknown';
export type ImpactTier = 'tier_1' | 'tier_2' | 'tier_3' | 'tier_4';

export interface BusinessService {
  id: string;
  name: string;
  description: string | null;
  ownerTeamId: string | null;
  ownerTeam: {
    id: string;
    name: string;
  } | null;
  pointOfContactId: string | null;
  pointOfContact: {
    id: string;
    fullName: string;
    email: string;
  } | null;
  status: BusinessServiceStatus;
  impactTier: ImpactTier;
  externalId: string | null;
  documentationUrl: string | null;
  services: {
    id: string;
    name: string;
    status: string;
  }[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateBusinessServiceRequest {
  name: string;
  description?: string;
  ownerTeamId?: string;
  pointOfContactId?: string;
  status?: BusinessServiceStatus;
  impactTier?: ImpactTier;
  externalId?: string;
  documentationUrl?: string;
}

export interface UpdateBusinessServiceRequest {
  name?: string;
  description?: string | null;
  ownerTeamId?: string | null;
  pointOfContactId?: string | null;
  status?: BusinessServiceStatus;
  impactTier?: ImpactTier;
  externalId?: string | null;
  documentationUrl?: string | null;
}

// Service Dependency Types
export type DependencyType = 'required' | 'optional' | 'runtime' | 'development';
export type DependencyImpactLevel = 'critical' | 'high' | 'medium' | 'low';

export interface ServiceDependency {
  id: string;
  dependentServiceId: string;
  dependentService?: {
    id: string;
    name: string;
  };
  supportingServiceId: string;
  supportingService?: {
    id: string;
    name: string;
  };
  dependencyType: DependencyType;
  impactLevel: DependencyImpactLevel;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDependencyRequest {
  dependentServiceId: string;
  supportingServiceId: string;
  dependencyType?: DependencyType;
  impactLevel?: DependencyImpactLevel;
  description?: string;
}

export interface UpdateDependencyRequest {
  dependencyType?: DependencyType;
  impactLevel?: DependencyImpactLevel;
  description?: string | null;
}

export interface ServiceDependencies {
  upstream: ServiceDependency[];
  downstream: ServiceDependency[];
}

export interface DependencyGraphNode {
  id: string;
  name: string;
  status: string;
  businessServiceId: string | null;
  businessServiceName: string | null;
}

export interface DependencyGraphEdge {
  id: string;
  source: string;
  target: string;
  dependencyType: DependencyType;
  impactLevel: DependencyImpactLevel;
}

export interface DependencyGraph {
  nodes: DependencyGraphNode[];
  edges: DependencyGraphEdge[];
}

// Event Transform Rule Types
export type TransformMatchType = 'all' | 'any';
export type RuleAction = 'continue' | 'suppress' | 'route';
export type TransformationType =
  | 'set_field'
  | 'copy_field'
  | 'regex_replace'
  | 'append'
  | 'prepend'
  | 'extract'
  | 'delete_field'
  | 'enrich';

export interface RuleCondition {
  field: string;
  operator: ConditionOperator;
  value: string | string[] | number | boolean | null;
}

export interface Transformation {
  type: TransformationType;
  field: string;
  value?: string | number | boolean | Record<string, any>;
  source?: string;
  pattern?: string;
  replacement?: string;
}

export interface EventTransformRule {
  id: string;
  serviceId: string;
  name: string;
  description: string | null;
  ruleOrder: number;
  enabled: boolean;
  conditions: RuleCondition[];
  matchType: TransformMatchType;
  transformations: Transformation[];
  action: RuleAction;
  routeToServiceId: string | null;
  routeToService: {
    id: string;
    name: string;
  } | null;
  eventsMatched: number;
  lastMatchedAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEventTransformRuleRequest {
  name: string;
  description?: string;
  enabled?: boolean;
  conditions?: RuleCondition[];
  matchType?: TransformMatchType;
  transformations?: Transformation[];
  action?: RuleAction;
  routeToServiceId?: string;
}

export interface UpdateEventTransformRuleRequest {
  name?: string;
  description?: string | null;
  enabled?: boolean;
  conditions?: RuleCondition[];
  matchType?: TransformMatchType;
  transformations?: Transformation[];
  action?: RuleAction;
  routeToServiceId?: string | null;
  ruleOrder?: number;
}

export interface EventTransformTestResult {
  matches: boolean;
  action: RuleAction | null;
  routeToService: { id: string; name: string } | null;
  originalPayload: Record<string, any>;
  transformedPayload: Record<string, any> | null;
}

// Tag Types
export type EntityType =
  | 'service'
  | 'incident'
  | 'business_service'
  | 'schedule'
  | 'escalation_policy'
  | 'runbook'
  | 'user'
  | 'team';

export interface Tag {
  id: string;
  name: string;
  color: string;
  description: string | null;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTagRequest {
  name: string;
  color?: string;
  description?: string;
}

export interface UpdateTagRequest {
  name?: string;
  color?: string;
  description?: string | null;
}

export interface BulkCreateTagRequest {
  tags: {
    name: string;
    color?: string;
    description?: string;
  }[];
}

export interface TagEntitiesResponse {
  tag: Tag;
  entities: Record<EntityType, string[]>;
  totalCount: number;
}

// Postmortem Types
export type PostmortemStatus = 'draft' | 'in_review' | 'published';

export interface PostmortemTimelineEntry {
  timestamp: string;
  event: string;
  description?: string;
}

export interface PostmortemActionItem {
  id: string;
  description: string;
  assignedTo?: string;
  dueDate?: string;
  completed: boolean;
  completedAt?: string;
}

export interface PostmortemTemplateSection {
  id: string;
  title: string;
  prompt: string;
  required: boolean;
  order: number;
}

export interface PostmortemTemplate {
  id: string;
  name: string;
  description: string | null;
  sections: PostmortemTemplateSection[];
  is_default: boolean;
  created_by: {
    id: string;
    full_name: string;
    email: string;
  } | null;
  created_at: string;
  updated_at: string;
}

export interface Postmortem {
  id: string;
  incident_id: string;
  incident: {
    id: string;
    incident_number: number;
    summary: string;
    service: {
      id: string;
      name: string;
    } | null;
  } | null;
  title: string;
  status: PostmortemStatus;
  summary: string | null;
  timeline: PostmortemTimelineEntry[];
  root_cause: string | null;
  contributing_factors: string[];
  impact: string | null;
  what_went_well: string | null;
  what_could_be_improved: string | null;
  action_items: PostmortemActionItem[];
  custom_sections: Record<string, any> | null;
  template_id: string | null;
  created_by: {
    id: string;
    full_name: string;
    email: string;
  } | null;
  published_by: {
    id: string;
    full_name: string;
    email: string;
  } | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

export interface CreatePostmortemRequest {
  incidentId: string;
  title: string;
  summary?: string;
  timeline?: PostmortemTimelineEntry[];
  rootCause?: string;
  impact?: string;
  whatWentWell?: string;
  whatCouldBeImproved?: string;
  actionItems?: PostmortemActionItem[];
  templateId?: string;
}

export interface UpdatePostmortemRequest {
  title?: string;
  summary?: string;
  timeline?: PostmortemTimelineEntry[];
  rootCause?: string;
  impact?: string;
  whatWentWell?: string;
  whatCouldBeImproved?: string;
  actionItems?: PostmortemActionItem[];
}

export interface CreatePostmortemTemplateRequest {
  name: string;
  description?: string;
  sections: PostmortemTemplateSection[];
  isDefault?: boolean;
}

// Cloud Credentials types
export type CloudProvider = 'aws' | 'azure' | 'gcp' | 'anthropic' | 'openai' | 'google';
export type AIProvider = 'anthropic' | 'openai' | 'google';
export type CloudPermissionLevel = 'read_only' | 'read_write';

export interface CloudCredential {
  id: string;
  org_id: string;
  provider: CloudProvider;
  name: string;
  description: string | null;
  permission_level: CloudPermissionLevel;
  allowed_services: string[];
  max_session_duration_minutes: number;
  require_approval_for_write: boolean;
  created_by: {
    id: string;
    full_name: string;
    email: string;
  } | null;
  last_used_at: string | null;
  last_used_by: {
    id: string;
    full_name: string;
    email: string;
  } | null;
  usage_count: number;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateCloudCredentialRequest {
  provider: CloudProvider;
  name: string;
  description?: string;
  credentials: Record<string, any>;
  permission_level?: CloudPermissionLevel;
  allowed_services?: string[];
  max_session_duration_minutes?: number;
  require_approval_for_write?: boolean;
}

export interface UpdateCloudCredentialRequest {
  name?: string;
  description?: string;
  credentials?: Record<string, any>;
  permission_level?: CloudPermissionLevel;
  allowed_services?: string[];
  max_session_duration_minutes?: number;
  require_approval_for_write?: boolean;
  enabled?: boolean;
}

export interface CloudAccessLog {
  id: string;
  credential_id: string;
  incident_id: string | null;
  user_id: string;
  user: {
    id: string;
    full_name: string;
    email: string;
  };
  provider: 'aws' | 'azure' | 'gcp';
  session_start: string;
  session_end: string | null;
  commands_executed: Array<{
    command: string;
    service: string;
    timestamp: string;
    result: 'success' | 'error' | 'access_denied';
  }>;
  findings: string[];
  recommendations: Array<{
    severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
    title: string;
    description: string;
    suggested_action?: string;
    command?: string;
    requires_approval?: boolean;
  }>;
  root_cause: string | null;
  ai_confidence: 'high' | 'medium' | 'low' | null;
  status: 'pending' | 'analyzing' | 'completed' | 'failed';
  error_message: string | null;
  created_at: string;
}

// AI Assistant Conversation Types
export interface AIConversation {
  id: string;
  status: 'active' | 'completed';
  created_at: string;
  updated_at: string;
  user: {
    id: string;
    name: string;
  } | null;
}

export interface AIConversationMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool_call' | 'tool_result';
  content: string | null;
  tool_name: string | null;
  tool_input: Record<string, any> | null;
  tool_output: Record<string, any> | null;
  created_at: string;
}

export interface AIAssistantPromptResponse {
  prompt: string;
  incident: {
    id: string;
    number: number;
    summary: string;
    severity: string;
    state: string;
    service: string | null;
  };
  available_credentials: Array<{
    id: string;
    name: string;
    provider: CloudProvider;
  }>;
}

export interface AIAssistantChatRequest {
  message: string;
  conversation_id?: string;
  credential_ids?: string[];
  model?: 'haiku' | 'sonnet' | 'opus';
}

// SSE Event types for AI Assistant streaming
export type AIAssistantStreamEvent =
  | { type: 'conversation_id'; id: string }
  | { type: 'text'; content: string }
  | { type: 'tool_call'; tool: string; input: Record<string, any> }
  | { type: 'tool_result'; tool: string; success: boolean; summary: string }
  | { type: 'done'; conversation_id: string }
  | { type: 'error'; error: string };
