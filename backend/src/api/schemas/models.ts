/**
 * OpenAPI Schema Definitions for TypeORM Models
 *
 * This file exports OpenAPI 3.0 schema definitions for all core database entities.
 * These schemas are used in swagger.ts for API documentation.
 */

// ============================================================================
// Common Response Schemas
// ============================================================================

export const PaginationSchema = {
  type: 'object',
  properties: {
    total: {
      type: 'integer',
      description: 'Total number of records matching the query',
      example: 100,
    },
    limit: {
      type: 'integer',
      description: 'Maximum number of records returned per page',
      example: 20,
    },
    offset: {
      type: 'integer',
      description: 'Number of records skipped from the beginning',
      example: 0,
    },
  },
  required: ['total', 'limit', 'offset'],
};

export const ErrorSchema = {
  type: 'object',
  properties: {
    error: {
      type: 'string',
      description: 'Error type or code',
      example: 'ValidationError',
    },
    message: {
      type: 'string',
      description: 'Human-readable error message',
      example: 'Invalid request parameters',
    },
    details: {
      type: 'string',
      description: 'Additional error details',
      nullable: true,
    },
  },
  required: ['error', 'message'],
};

export const UnauthorizedErrorSchema = {
  type: 'object',
  properties: {
    error: {
      type: 'string',
      example: 'Unauthorized',
    },
    message: {
      type: 'string',
      example: 'Authentication required',
    },
  },
  required: ['error', 'message'],
};

export const ForbiddenErrorSchema = {
  type: 'object',
  properties: {
    error: {
      type: 'string',
      example: 'Forbidden',
    },
    message: {
      type: 'string',
      example: 'You do not have permission to access this resource',
    },
  },
  required: ['error', 'message'],
};

export const NotFoundErrorSchema = {
  type: 'object',
  properties: {
    error: {
      type: 'string',
      example: 'NotFound',
    },
    message: {
      type: 'string',
      example: 'Resource not found',
    },
  },
  required: ['error', 'message'],
};

export const ValidationErrorSchema = {
  type: 'object',
  properties: {
    error: {
      type: 'string',
      example: 'ValidationError',
    },
    message: {
      type: 'string',
      example: 'Validation failed',
    },
    details: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          field: { type: 'string', example: 'email' },
          message: { type: 'string', example: 'Invalid email format' },
        },
      },
    },
  },
  required: ['error', 'message'],
};

// ============================================================================
// Tier 1: Core Resource Schemas (Team, User, Service, EscalationPolicy, Schedule)
// ============================================================================

// --- Team ---

export const TeamSettingsSchema = {
  type: 'object',
  properties: {
    defaultEscalationPolicyId: {
      type: 'string',
      format: 'uuid',
      nullable: true,
      description: 'Default escalation policy for this team',
    },
    defaultScheduleId: {
      type: 'string',
      format: 'uuid',
      nullable: true,
      description: 'Default schedule for this team',
    },
    slackChannelId: {
      type: 'string',
      nullable: true,
      description: 'Slack channel ID for team notifications',
    },
    teamsChannelId: {
      type: 'string',
      nullable: true,
      description: 'Microsoft Teams channel ID for team notifications',
    },
  },
};

export const TeamSchema = {
  type: 'object',
  properties: {
    id: {
      type: 'string',
      format: 'uuid',
      description: 'Unique identifier for the team',
    },
    orgId: {
      type: 'string',
      format: 'uuid',
      description: 'Organization ID this team belongs to',
    },
    name: {
      type: 'string',
      maxLength: 255,
      description: 'Team name',
      example: 'Platform Engineering',
    },
    description: {
      type: 'string',
      nullable: true,
      description: 'Team description',
    },
    privacy: {
      type: 'string',
      enum: ['public', 'private'],
      default: 'public',
      description: 'Team visibility (private teams only visible to members)',
    },
    slug: {
      type: 'string',
      maxLength: 100,
      nullable: true,
      description: 'URL-friendly identifier',
      example: 'platform-engineering',
    },
    settings: TeamSettingsSchema,
    createdAt: {
      type: 'string',
      format: 'date-time',
      description: 'When the team was created',
    },
    updatedAt: {
      type: 'string',
      format: 'date-time',
      description: 'When the team was last updated',
    },
  },
  required: ['id', 'orgId', 'name', 'privacy', 'settings', 'createdAt', 'updatedAt'],
};

export const TeamCreateSchema = {
  type: 'object',
  properties: {
    name: {
      type: 'string',
      maxLength: 255,
      description: 'Team name',
    },
    description: {
      type: 'string',
      nullable: true,
      description: 'Team description',
    },
    privacy: {
      type: 'string',
      enum: ['public', 'private'],
      default: 'public',
    },
    slug: {
      type: 'string',
      maxLength: 100,
      nullable: true,
    },
    settings: TeamSettingsSchema,
  },
  required: ['name'],
};

export const TeamUpdateSchema = {
  type: 'object',
  properties: {
    name: { type: 'string', maxLength: 255 },
    description: { type: 'string', nullable: true },
    privacy: { type: 'string', enum: ['public', 'private'] },
    slug: { type: 'string', maxLength: 100, nullable: true },
    settings: TeamSettingsSchema,
  },
};

// --- User ---

export const UserSchema = {
  type: 'object',
  properties: {
    id: {
      type: 'string',
      format: 'uuid',
      description: 'Unique identifier for the user',
    },
    orgId: {
      type: 'string',
      format: 'uuid',
      description: 'Organization ID this user belongs to',
    },
    email: {
      type: 'string',
      format: 'email',
      maxLength: 255,
      description: 'User email address (unique)',
    },
    fullName: {
      type: 'string',
      maxLength: 255,
      nullable: true,
      description: 'User full name',
      example: 'Jane Doe',
    },
    role: {
      type: 'string',
      enum: ['admin', 'member'],
      deprecated: true,
      description: 'DEPRECATED: Use baseRole instead',
    },
    baseRole: {
      type: 'string',
      enum: ['owner', 'admin', 'manager', 'responder', 'observer', 'restricted_access', 'limited_stakeholder'],
      default: 'responder',
      description: 'User role determining permissions',
    },
    status: {
      type: 'string',
      enum: ['active', 'inactive'],
      default: 'active',
      description: 'User account status',
    },
    phoneNumber: {
      type: 'string',
      maxLength: 50,
      nullable: true,
      description: 'User phone number for SMS/voice notifications',
      example: '+1-555-123-4567',
    },
    profilePictureUrl: {
      type: 'string',
      maxLength: 500,
      nullable: true,
      description: 'URL to user profile picture',
    },
    settings: {
      type: 'object',
      nullable: true,
      description: 'User-specific settings',
      additionalProperties: true,
    },
    dndEnabled: {
      type: 'boolean',
      default: false,
      description: 'Whether Do Not Disturb mode is enabled',
    },
    dndStartTime: {
      type: 'string',
      nullable: true,
      description: 'DND start time in HH:mm format',
      example: '22:00',
    },
    dndEndTime: {
      type: 'string',
      nullable: true,
      description: 'DND end time in HH:mm format',
      example: '08:00',
    },
    dndTimezone: {
      type: 'string',
      maxLength: 100,
      nullable: true,
      description: 'IANA timezone for DND schedule',
      example: 'America/New_York',
    },
    createdAt: {
      type: 'string',
      format: 'date-time',
      description: 'When the user was created',
    },
    updatedAt: {
      type: 'string',
      format: 'date-time',
      description: 'When the user was last updated',
    },
  },
  required: ['id', 'orgId', 'email', 'baseRole', 'status', 'createdAt', 'updatedAt'],
};

export const UserCreateSchema = {
  type: 'object',
  properties: {
    email: {
      type: 'string',
      format: 'email',
      description: 'User email address',
    },
    fullName: {
      type: 'string',
      nullable: true,
      description: 'User full name',
    },
    baseRole: {
      type: 'string',
      enum: ['owner', 'admin', 'manager', 'responder', 'observer', 'restricted_access', 'limited_stakeholder'],
      default: 'responder',
    },
    phoneNumber: {
      type: 'string',
      nullable: true,
    },
  },
  required: ['email'],
};

export const UserUpdateSchema = {
  type: 'object',
  properties: {
    fullName: { type: 'string', nullable: true },
    baseRole: {
      type: 'string',
      enum: ['owner', 'admin', 'manager', 'responder', 'observer', 'restricted_access', 'limited_stakeholder'],
    },
    status: { type: 'string', enum: ['active', 'inactive'] },
    phoneNumber: { type: 'string', nullable: true },
    profilePictureUrl: { type: 'string', nullable: true },
    settings: { type: 'object', nullable: true, additionalProperties: true },
    dndEnabled: { type: 'boolean' },
    dndStartTime: { type: 'string', nullable: true },
    dndEndTime: { type: 'string', nullable: true },
    dndTimezone: { type: 'string', nullable: true },
  },
};

// --- Service ---

export const SupportHoursSchema = {
  type: 'object',
  properties: {
    enabled: {
      type: 'boolean',
      description: 'Whether support hours are enabled',
    },
    timezone: {
      type: 'string',
      description: 'IANA timezone for support hours',
      example: 'America/New_York',
    },
    days: {
      type: 'array',
      items: { type: 'integer', minimum: 0, maximum: 6 },
      description: 'Days when support is available (0=Sunday, 6=Saturday)',
      example: [1, 2, 3, 4, 5],
    },
    startTime: {
      type: 'string',
      description: 'Support hours start time in HH:mm format',
      example: '09:00',
    },
    endTime: {
      type: 'string',
      description: 'Support hours end time in HH:mm format',
      example: '17:00',
    },
  },
  required: ['enabled', 'timezone', 'days', 'startTime', 'endTime'],
};

export const ServiceExternalKeysSchema = {
  type: 'object',
  properties: {
    pagerduty: {
      type: 'string',
      nullable: true,
      description: 'PagerDuty integration key for migration',
    },
    opsgenie: {
      type: 'string',
      nullable: true,
      description: 'OpsGenie integration key for migration',
    },
  },
};

export const ServiceSchema = {
  type: 'object',
  properties: {
    id: {
      type: 'string',
      format: 'uuid',
      description: 'Unique identifier for the service',
    },
    orgId: {
      type: 'string',
      format: 'uuid',
      description: 'Organization ID this service belongs to',
    },
    teamId: {
      type: 'string',
      format: 'uuid',
      nullable: true,
      description: 'Team ID this service is associated with',
    },
    name: {
      type: 'string',
      maxLength: 255,
      description: 'Service name',
      example: 'Payment Gateway',
    },
    description: {
      type: 'string',
      nullable: true,
      description: 'Service description',
    },
    apiKey: {
      type: 'string',
      maxLength: 255,
      description: 'API key for webhook authentication (auto-generated)',
      example: 'svc_abc123def456',
    },
    emailAddress: {
      type: 'string',
      format: 'email',
      maxLength: 255,
      nullable: true,
      description: 'Email address for email-to-incident',
    },
    webhookSecret: {
      type: 'string',
      maxLength: 255,
      nullable: true,
      description: 'HMAC-SHA256 secret for webhook signature verification',
    },
    scheduleId: {
      type: 'string',
      format: 'uuid',
      nullable: true,
      description: 'Default schedule for this service',
    },
    escalationPolicyId: {
      type: 'string',
      format: 'uuid',
      nullable: true,
      description: 'Escalation policy for this service',
    },
    businessServiceId: {
      type: 'string',
      format: 'uuid',
      nullable: true,
      description: 'Business service this technical service supports',
    },
    status: {
      type: 'string',
      enum: ['active', 'inactive', 'maintenance'],
      default: 'active',
      description: 'Service operational status',
    },
    autoResolveTimeout: {
      type: 'integer',
      nullable: true,
      description: 'Auto-resolve incidents after this many minutes',
    },
    urgency: {
      type: 'string',
      enum: ['high', 'low', 'dynamic'],
      default: 'high',
      description: 'Incident urgency (dynamic uses support hours)',
    },
    supportHours: {
      ...SupportHoursSchema,
      nullable: true,
      description: 'Support hours configuration for dynamic urgency',
    },
    ackTimeoutSeconds: {
      type: 'integer',
      nullable: true,
      description: 'Auto-unacknowledge timeout in seconds',
    },
    settings: {
      type: 'object',
      nullable: true,
      additionalProperties: true,
      description: 'Service-specific settings',
    },
    externalKeys: {
      ...ServiceExternalKeysSchema,
      nullable: true,
      description: 'External integration keys for migration',
    },
    createdAt: {
      type: 'string',
      format: 'date-time',
      description: 'When the service was created',
    },
    updatedAt: {
      type: 'string',
      format: 'date-time',
      description: 'When the service was last updated',
    },
  },
  required: ['id', 'orgId', 'name', 'apiKey', 'status', 'urgency', 'createdAt', 'updatedAt'],
};

export const ServiceCreateSchema = {
  type: 'object',
  properties: {
    name: { type: 'string', maxLength: 255 },
    description: { type: 'string', nullable: true },
    teamId: { type: 'string', format: 'uuid', nullable: true },
    scheduleId: { type: 'string', format: 'uuid', nullable: true },
    escalationPolicyId: { type: 'string', format: 'uuid', nullable: true },
    businessServiceId: { type: 'string', format: 'uuid', nullable: true },
    status: { type: 'string', enum: ['active', 'inactive', 'maintenance'] },
    autoResolveTimeout: { type: 'integer', nullable: true },
    urgency: { type: 'string', enum: ['high', 'low', 'dynamic'] },
    supportHours: SupportHoursSchema,
    ackTimeoutSeconds: { type: 'integer', nullable: true },
    settings: { type: 'object', nullable: true, additionalProperties: true },
    externalKeys: ServiceExternalKeysSchema,
  },
  required: ['name'],
};

export const ServiceUpdateSchema = {
  type: 'object',
  properties: {
    name: { type: 'string', maxLength: 255 },
    description: { type: 'string', nullable: true },
    teamId: { type: 'string', format: 'uuid', nullable: true },
    scheduleId: { type: 'string', format: 'uuid', nullable: true },
    escalationPolicyId: { type: 'string', format: 'uuid', nullable: true },
    businessServiceId: { type: 'string', format: 'uuid', nullable: true },
    status: { type: 'string', enum: ['active', 'inactive', 'maintenance'] },
    autoResolveTimeout: { type: 'integer', nullable: true },
    urgency: { type: 'string', enum: ['high', 'low', 'dynamic'] },
    supportHours: { ...SupportHoursSchema, nullable: true },
    ackTimeoutSeconds: { type: 'integer', nullable: true },
    settings: { type: 'object', nullable: true, additionalProperties: true },
    externalKeys: { ...ServiceExternalKeysSchema, nullable: true },
  },
};

// --- Escalation Policy ---

export const EscalationStepSchema = {
  type: 'object',
  properties: {
    id: {
      type: 'string',
      format: 'uuid',
      description: 'Unique identifier for the escalation step',
    },
    escalationPolicyId: {
      type: 'string',
      format: 'uuid',
      description: 'Escalation policy this step belongs to',
    },
    stepOrder: {
      type: 'integer',
      minimum: 1,
      description: 'Order of this step in the escalation sequence',
    },
    targetType: {
      type: 'string',
      enum: ['schedule', 'users'],
      description: 'Type of target for this step',
    },
    scheduleId: {
      type: 'string',
      format: 'uuid',
      nullable: true,
      description: 'Schedule ID when targetType is "schedule"',
    },
    userIds: {
      type: 'array',
      items: { type: 'string', format: 'uuid' },
      nullable: true,
      description: 'User IDs when targetType is "users"',
    },
    timeoutSeconds: {
      type: 'integer',
      default: 300,
      description: 'Seconds to wait before escalating to next step',
    },
    notifyStrategy: {
      type: 'string',
      enum: ['all', 'round_robin'],
      default: 'all',
      description: 'How to notify targets (all at once or in rotation)',
    },
    createdAt: {
      type: 'string',
      format: 'date-time',
    },
    updatedAt: {
      type: 'string',
      format: 'date-time',
    },
  },
  required: ['id', 'escalationPolicyId', 'stepOrder', 'targetType', 'timeoutSeconds', 'notifyStrategy'],
};

export const EscalationStepCreateSchema = {
  type: 'object',
  properties: {
    stepOrder: { type: 'integer', minimum: 1 },
    targetType: { type: 'string', enum: ['schedule', 'users'] },
    scheduleId: { type: 'string', format: 'uuid', nullable: true },
    userIds: { type: 'array', items: { type: 'string', format: 'uuid' }, nullable: true },
    timeoutSeconds: { type: 'integer', default: 300 },
    notifyStrategy: { type: 'string', enum: ['all', 'round_robin'], default: 'all' },
  },
  required: ['stepOrder', 'targetType'],
};

export const EscalationPolicySchema = {
  type: 'object',
  properties: {
    id: {
      type: 'string',
      format: 'uuid',
      description: 'Unique identifier for the escalation policy',
    },
    orgId: {
      type: 'string',
      format: 'uuid',
      description: 'Organization ID this policy belongs to',
    },
    teamId: {
      type: 'string',
      format: 'uuid',
      nullable: true,
      description: 'Team ID this policy is associated with',
    },
    name: {
      type: 'string',
      maxLength: 255,
      description: 'Escalation policy name',
      example: 'Primary On-Call Escalation',
    },
    description: {
      type: 'string',
      nullable: true,
      description: 'Policy description',
    },
    repeatEnabled: {
      type: 'boolean',
      default: false,
      description: 'Whether to repeat escalation after exhausting all steps',
    },
    repeatCount: {
      type: 'integer',
      default: 0,
      description: 'Number of times to repeat (0 = infinite if repeatEnabled)',
    },
    steps: {
      type: 'array',
      items: EscalationStepSchema,
      description: 'Ordered list of escalation steps',
    },
    createdAt: {
      type: 'string',
      format: 'date-time',
      description: 'When the policy was created',
    },
    updatedAt: {
      type: 'string',
      format: 'date-time',
      description: 'When the policy was last updated',
    },
  },
  required: ['id', 'orgId', 'name', 'repeatEnabled', 'repeatCount', 'createdAt', 'updatedAt'],
};

export const EscalationPolicyCreateSchema = {
  type: 'object',
  properties: {
    name: { type: 'string', maxLength: 255 },
    description: { type: 'string', nullable: true },
    teamId: { type: 'string', format: 'uuid', nullable: true },
    repeatEnabled: { type: 'boolean', default: false },
    repeatCount: { type: 'integer', default: 0 },
    steps: {
      type: 'array',
      items: EscalationStepCreateSchema,
    },
  },
  required: ['name'],
};

export const EscalationPolicyUpdateSchema = {
  type: 'object',
  properties: {
    name: { type: 'string', maxLength: 255 },
    description: { type: 'string', nullable: true },
    teamId: { type: 'string', format: 'uuid', nullable: true },
    repeatEnabled: { type: 'boolean' },
    repeatCount: { type: 'integer' },
    steps: {
      type: 'array',
      items: EscalationStepCreateSchema,
    },
  },
};

// --- Schedule ---

export const LayerRestrictionsSchema = {
  type: 'object',
  properties: {
    type: {
      type: 'string',
      enum: ['weekly'],
      description: 'Restriction type',
    },
    intervals: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          startDay: {
            type: 'integer',
            minimum: 0,
            maximum: 6,
            description: 'Start day (0=Sunday)',
          },
          startTime: {
            type: 'string',
            description: 'Start time in HH:mm format',
            example: '09:00',
          },
          endDay: {
            type: 'integer',
            minimum: 0,
            maximum: 6,
            description: 'End day (0=Sunday)',
          },
          endTime: {
            type: 'string',
            description: 'End time in HH:mm format',
            example: '17:00',
          },
        },
        required: ['startDay', 'startTime', 'endDay', 'endTime'],
      },
    },
  },
};

export const ScheduleLayerMemberSchema = {
  type: 'object',
  properties: {
    id: {
      type: 'string',
      format: 'uuid',
    },
    layerId: {
      type: 'string',
      format: 'uuid',
    },
    userId: {
      type: 'string',
      format: 'uuid',
    },
    position: {
      type: 'integer',
      description: 'Position in the rotation order',
    },
    createdAt: {
      type: 'string',
      format: 'date-time',
    },
  },
  required: ['id', 'layerId', 'userId', 'position'],
};

export const ScheduleLayerSchema = {
  type: 'object',
  properties: {
    id: {
      type: 'string',
      format: 'uuid',
      description: 'Unique identifier for the schedule layer',
    },
    scheduleId: {
      type: 'string',
      format: 'uuid',
      description: 'Schedule this layer belongs to',
    },
    name: {
      type: 'string',
      maxLength: 255,
      description: 'Layer name',
      example: 'Primary On-Call',
    },
    rotationType: {
      type: 'string',
      enum: ['daily', 'weekly', 'custom'],
      description: 'How often the rotation advances',
    },
    startDate: {
      type: 'string',
      format: 'date-time',
      description: 'When this layer becomes active',
    },
    endDate: {
      type: 'string',
      format: 'date-time',
      nullable: true,
      description: 'When this layer ends (null = indefinite)',
    },
    handoffTime: {
      type: 'string',
      default: '09:00:00',
      description: 'Time of day when rotation handoff occurs',
      example: '09:00:00',
    },
    handoffDay: {
      type: 'integer',
      minimum: 0,
      maximum: 6,
      nullable: true,
      description: 'Day of week for handoff (weekly rotation)',
    },
    rotationLength: {
      type: 'integer',
      default: 1,
      description: 'Number of days per rotation (for custom type)',
    },
    layerOrder: {
      type: 'integer',
      default: 0,
      description: 'Layer priority (lower = higher priority)',
    },
    restrictions: {
      ...LayerRestrictionsSchema,
      nullable: true,
      description: 'Time restrictions for when this layer is active',
    },
    members: {
      type: 'array',
      items: ScheduleLayerMemberSchema,
      description: 'Members in the rotation',
    },
    createdAt: {
      type: 'string',
      format: 'date-time',
    },
    updatedAt: {
      type: 'string',
      format: 'date-time',
    },
  },
  required: ['id', 'scheduleId', 'name', 'rotationType', 'startDate', 'layerOrder'],
};

export const ScheduleLayerCreateSchema = {
  type: 'object',
  properties: {
    name: { type: 'string', maxLength: 255 },
    rotationType: { type: 'string', enum: ['daily', 'weekly', 'custom'] },
    startDate: { type: 'string', format: 'date-time' },
    endDate: { type: 'string', format: 'date-time', nullable: true },
    handoffTime: { type: 'string', default: '09:00:00' },
    handoffDay: { type: 'integer', minimum: 0, maximum: 6, nullable: true },
    rotationLength: { type: 'integer', default: 1 },
    layerOrder: { type: 'integer', default: 0 },
    restrictions: LayerRestrictionsSchema,
    userIds: {
      type: 'array',
      items: { type: 'string', format: 'uuid' },
      description: 'User IDs to add to the rotation',
    },
  },
  required: ['name', 'rotationType', 'startDate'],
};

export const ScheduleMemberSchema = {
  type: 'object',
  properties: {
    id: {
      type: 'string',
      format: 'uuid',
    },
    scheduleId: {
      type: 'string',
      format: 'uuid',
    },
    userId: {
      type: 'string',
      format: 'uuid',
    },
    position: {
      type: 'integer',
      description: 'Position in the rotation order',
    },
    addedBy: {
      type: 'string',
      format: 'uuid',
      nullable: true,
    },
    createdAt: {
      type: 'string',
      format: 'date-time',
    },
    updatedAt: {
      type: 'string',
      format: 'date-time',
    },
  },
  required: ['id', 'scheduleId', 'userId', 'position'],
};

export const ScheduleSchema = {
  type: 'object',
  properties: {
    id: {
      type: 'string',
      format: 'uuid',
      description: 'Unique identifier for the schedule',
    },
    orgId: {
      type: 'string',
      format: 'uuid',
      description: 'Organization ID this schedule belongs to',
    },
    teamId: {
      type: 'string',
      format: 'uuid',
      nullable: true,
      description: 'Team ID this schedule is associated with',
    },
    name: {
      type: 'string',
      maxLength: 255,
      description: 'Schedule name',
      example: 'Primary On-Call Schedule',
    },
    description: {
      type: 'string',
      nullable: true,
      description: 'Schedule description',
    },
    type: {
      type: 'string',
      enum: ['manual', 'daily', 'weekly'],
      default: 'manual',
      description: 'Schedule rotation type',
    },
    timezone: {
      type: 'string',
      maxLength: 100,
      default: 'UTC',
      description: 'IANA timezone for the schedule',
      example: 'America/New_York',
    },
    currentOncallUserId: {
      type: 'string',
      format: 'uuid',
      nullable: true,
      description: 'Currently on-call user (for manual schedules)',
    },
    overrideUserId: {
      type: 'string',
      format: 'uuid',
      nullable: true,
      description: 'Legacy: Override user for "take on-call" feature',
    },
    overrideUntil: {
      type: 'string',
      format: 'date-time',
      nullable: true,
      description: 'Legacy: When the override expires',
    },
    rotation_config: {
      type: 'object',
      nullable: true,
      additionalProperties: true,
      description: 'Rotation configuration for daily/weekly schedules',
    },
    layers: {
      type: 'array',
      items: ScheduleLayerSchema,
      description: 'Schedule layers for complex rotations',
    },
    createdAt: {
      type: 'string',
      format: 'date-time',
      description: 'When the schedule was created',
    },
    updatedAt: {
      type: 'string',
      format: 'date-time',
      description: 'When the schedule was last updated',
    },
  },
  required: ['id', 'orgId', 'name', 'type', 'timezone', 'createdAt', 'updatedAt'],
};

export const ScheduleCreateSchema = {
  type: 'object',
  properties: {
    name: { type: 'string', maxLength: 255 },
    description: { type: 'string', nullable: true },
    teamId: { type: 'string', format: 'uuid', nullable: true },
    type: { type: 'string', enum: ['manual', 'daily', 'weekly'] },
    timezone: { type: 'string', maxLength: 100, default: 'UTC' },
    currentOncallUserId: { type: 'string', format: 'uuid', nullable: true },
    rotation_config: { type: 'object', nullable: true, additionalProperties: true },
    layers: {
      type: 'array',
      items: ScheduleLayerCreateSchema,
    },
  },
  required: ['name'],
};

export const ScheduleUpdateSchema = {
  type: 'object',
  properties: {
    name: { type: 'string', maxLength: 255 },
    description: { type: 'string', nullable: true },
    teamId: { type: 'string', format: 'uuid', nullable: true },
    type: { type: 'string', enum: ['manual', 'daily', 'weekly'] },
    timezone: { type: 'string', maxLength: 100 },
    currentOncallUserId: { type: 'string', format: 'uuid', nullable: true },
    rotation_config: { type: 'object', nullable: true, additionalProperties: true },
  },
};

// ============================================================================
// Tier 2: Additional Resource Schemas
// ============================================================================

// --- Incident (Enhanced) ---

export const IncidentSchema = {
  type: 'object',
  properties: {
    id: {
      type: 'string',
      format: 'uuid',
      description: 'Unique identifier for the incident',
    },
    orgId: {
      type: 'string',
      format: 'uuid',
      description: 'Organization ID this incident belongs to',
    },
    serviceId: {
      type: 'string',
      format: 'uuid',
      description: 'Service this incident is associated with',
    },
    incidentNumber: {
      type: 'integer',
      description: 'Auto-incrementing incident number per organization',
      example: 42,
    },
    dedupKey: {
      type: 'string',
      maxLength: 255,
      nullable: true,
      description: 'Deduplication key for grouping related alerts',
    },
    summary: {
      type: 'string',
      maxLength: 500,
      description: 'Brief summary of the incident',
      example: 'High CPU utilization on web-server-01',
    },
    details: {
      type: 'object',
      nullable: true,
      additionalProperties: true,
      description: 'Additional incident details/metadata',
    },
    severity: {
      type: 'string',
      enum: ['info', 'warning', 'error', 'critical'],
      default: 'error',
      description: 'Incident severity level',
    },
    state: {
      type: 'string',
      enum: ['triggered', 'acknowledged', 'resolved'],
      default: 'triggered',
      description: 'Current incident state',
    },
    urgency: {
      type: 'string',
      enum: ['high', 'low'],
      default: 'high',
      description: 'Incident urgency affecting notification behavior',
    },
    triggeredAt: {
      type: 'string',
      format: 'date-time',
      description: 'When the incident was triggered',
    },
    acknowledgedAt: {
      type: 'string',
      format: 'date-time',
      nullable: true,
      description: 'When the incident was acknowledged',
    },
    acknowledgedBy: {
      type: 'string',
      format: 'uuid',
      nullable: true,
      description: 'User who acknowledged the incident',
    },
    resolvedAt: {
      type: 'string',
      format: 'date-time',
      nullable: true,
      description: 'When the incident was resolved',
    },
    resolvedBy: {
      type: 'string',
      format: 'uuid',
      nullable: true,
      description: 'User who resolved the incident',
    },
    eventCount: {
      type: 'integer',
      default: 1,
      description: 'Number of times this incident was triggered (deduplication)',
    },
    lastEventAt: {
      type: 'string',
      format: 'date-time',
      description: 'Timestamp of the last event for this incident',
    },
    currentEscalationStep: {
      type: 'integer',
      default: 0,
      description: 'Current step in the escalation policy',
    },
    escalationStartedAt: {
      type: 'string',
      format: 'date-time',
      nullable: true,
      description: 'When escalation began for this incident',
    },
    assignedToUserId: {
      type: 'string',
      format: 'uuid',
      nullable: true,
      description: 'User the incident is assigned to',
    },
    assignedAt: {
      type: 'string',
      format: 'date-time',
      nullable: true,
      description: 'When the incident was assigned',
    },
    mergedIntoIncidentId: {
      type: 'string',
      format: 'uuid',
      nullable: true,
      description: 'Parent incident if this was merged',
    },
    priorityId: {
      type: 'string',
      format: 'uuid',
      nullable: true,
      description: 'Priority level ID',
    },
    snoozedUntil: {
      type: 'string',
      format: 'date-time',
      nullable: true,
      description: 'When the snooze expires',
    },
    snoozedBy: {
      type: 'string',
      format: 'uuid',
      nullable: true,
      description: 'User who snoozed the incident',
    },
    conferenceBridgeUrl: {
      type: 'string',
      maxLength: 500,
      nullable: true,
      description: 'Video conference URL for war room',
    },
    createdAt: {
      type: 'string',
      format: 'date-time',
    },
    updatedAt: {
      type: 'string',
      format: 'date-time',
    },
  },
  required: [
    'id',
    'orgId',
    'serviceId',
    'incidentNumber',
    'summary',
    'severity',
    'state',
    'urgency',
    'triggeredAt',
    'eventCount',
    'currentEscalationStep',
    'createdAt',
    'updatedAt',
  ],
};

// --- Notification ---

export const NotificationSchema = {
  type: 'object',
  properties: {
    id: {
      type: 'string',
      format: 'uuid',
      description: 'Unique identifier for the notification',
    },
    incidentId: {
      type: 'string',
      format: 'uuid',
      description: 'Incident this notification is for',
    },
    userId: {
      type: 'string',
      format: 'uuid',
      description: 'User to be notified',
    },
    channel: {
      type: 'string',
      enum: ['push', 'sms', 'voice', 'email'],
      description: 'Notification delivery channel',
    },
    status: {
      type: 'string',
      enum: ['pending', 'sent', 'delivered', 'failed', 'opened'],
      default: 'pending',
      description: 'Current notification status',
    },
    sentAt: {
      type: 'string',
      format: 'date-time',
      nullable: true,
      description: 'When the notification was sent',
    },
    deliveredAt: {
      type: 'string',
      format: 'date-time',
      nullable: true,
      description: 'When the notification was delivered',
    },
    openedAt: {
      type: 'string',
      format: 'date-time',
      nullable: true,
      description: 'When the notification was opened/read',
    },
    failedAt: {
      type: 'string',
      format: 'date-time',
      nullable: true,
      description: 'When the notification failed',
    },
    errorMessage: {
      type: 'string',
      nullable: true,
      description: 'Error message if notification failed',
    },
    externalId: {
      type: 'string',
      maxLength: 255,
      nullable: true,
      description: 'External provider ID (SNS, Twilio, etc.)',
    },
    metadata: {
      type: 'object',
      nullable: true,
      additionalProperties: true,
      description: 'Additional notification metadata',
    },
    createdAt: {
      type: 'string',
      format: 'date-time',
    },
    updatedAt: {
      type: 'string',
      format: 'date-time',
    },
  },
  required: ['id', 'incidentId', 'userId', 'channel', 'status', 'createdAt', 'updatedAt'],
};

// --- Runbook ---

export const RunbookStepSchema = {
  type: 'object',
  properties: {
    id: {
      type: 'string',
      description: 'Step identifier',
    },
    order: {
      type: 'integer',
      description: 'Step order in the runbook',
    },
    title: {
      type: 'string',
      description: 'Step title',
    },
    description: {
      type: 'string',
      description: 'Step description/instructions',
    },
    isOptional: {
      type: 'boolean',
      description: 'Whether this step can be skipped',
    },
    estimatedMinutes: {
      type: 'integer',
      nullable: true,
      description: 'Estimated time to complete this step',
    },
    type: {
      type: 'string',
      enum: ['manual', 'automated'],
      description: 'Step execution type',
    },
    automation: {
      type: 'object',
      nullable: true,
      properties: {
        mode: {
          type: 'string',
          enum: ['server_sandbox', 'claude_code_api', 'hybrid'],
        },
        script: {
          type: 'object',
          properties: {
            language: { type: 'string', enum: ['bash', 'python', 'javascript', 'natural_language'] },
            code: { type: 'string' },
            naturalLanguageDescription: { type: 'string', nullable: true },
            version: { type: 'integer' },
          },
        },
        timeout: { type: 'integer', description: 'Timeout in seconds' },
        requiresApproval: { type: 'boolean' },
        credentialIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Cloud credential IDs to inject',
        },
      },
    },
  },
  required: ['id', 'order', 'title', 'description', 'isOptional', 'type'],
};

export const RunbookSchema = {
  type: 'object',
  properties: {
    id: {
      type: 'string',
      format: 'uuid',
      description: 'Unique identifier for the runbook',
    },
    orgId: {
      type: 'string',
      format: 'uuid',
      description: 'Organization ID this runbook belongs to',
    },
    serviceId: {
      type: 'string',
      format: 'uuid',
      description: 'Service this runbook is associated with',
    },
    title: {
      type: 'string',
      maxLength: 255,
      description: 'Runbook title',
      example: 'Database Connection Pool Exhaustion',
    },
    description: {
      type: 'string',
      nullable: true,
      description: 'Runbook description',
    },
    steps: {
      type: 'array',
      items: RunbookStepSchema,
      description: 'Ordered list of runbook steps',
    },
    severity: {
      type: 'array',
      items: { type: 'string' },
      description: 'Severities this runbook applies to (empty = all)',
    },
    tags: {
      type: 'array',
      items: { type: 'string' },
      description: 'Tags for matching runbooks to incidents',
    },
    externalUrl: {
      type: 'string',
      maxLength: 2048,
      nullable: true,
      description: 'Link to external documentation',
    },
    createdById: {
      type: 'string',
      format: 'uuid',
      description: 'User who created this runbook',
    },
    isActive: {
      type: 'boolean',
      default: true,
      description: 'Whether this runbook is active',
    },
    createdAt: {
      type: 'string',
      format: 'date-time',
    },
    updatedAt: {
      type: 'string',
      format: 'date-time',
    },
  },
  required: ['id', 'orgId', 'serviceId', 'title', 'steps', 'createdById', 'isActive', 'createdAt', 'updatedAt'],
};

export const RunbookCreateSchema = {
  type: 'object',
  properties: {
    serviceId: { type: 'string', format: 'uuid' },
    title: { type: 'string', maxLength: 255 },
    description: { type: 'string', nullable: true },
    steps: { type: 'array', items: RunbookStepSchema },
    severity: { type: 'array', items: { type: 'string' } },
    tags: { type: 'array', items: { type: 'string' } },
    externalUrl: { type: 'string', maxLength: 2048, nullable: true },
    isActive: { type: 'boolean', default: true },
  },
  required: ['serviceId', 'title', 'steps'],
};

// --- Integration ---

export const IntegrationFeaturesSchema = {
  type: 'object',
  properties: {
    incident_sync: { type: 'boolean' },
    bidirectional: { type: 'boolean' },
    auto_create_channel: { type: 'boolean' },
    auto_resolve: { type: 'boolean' },
    sync_comments: { type: 'boolean' },
    sync_status: { type: 'boolean' },
  },
};

export const IntegrationSchema = {
  type: 'object',
  properties: {
    id: {
      type: 'string',
      format: 'uuid',
      description: 'Unique identifier for the integration',
    },
    orgId: {
      type: 'string',
      format: 'uuid',
      description: 'Organization ID this integration belongs to',
    },
    type: {
      type: 'string',
      enum: ['slack', 'teams', 'jira', 'servicenow', 'webhook', 'pagerduty_import'],
      description: 'Integration type',
    },
    name: {
      type: 'string',
      maxLength: 255,
      description: 'Integration name',
      example: 'Engineering Slack',
    },
    status: {
      type: 'string',
      enum: ['pending', 'active', 'error', 'disabled'],
      default: 'pending',
      description: 'Integration status',
    },
    config: {
      type: 'object',
      additionalProperties: true,
      description: 'Type-specific configuration',
    },
    slackWorkspaceId: {
      type: 'string',
      maxLength: 50,
      nullable: true,
    },
    slackWorkspaceName: {
      type: 'string',
      maxLength: 255,
      nullable: true,
    },
    slackDefaultChannelId: {
      type: 'string',
      maxLength: 50,
      nullable: true,
    },
    teamsTenantId: {
      type: 'string',
      maxLength: 50,
      nullable: true,
    },
    teamsTeamId: {
      type: 'string',
      maxLength: 50,
      nullable: true,
    },
    teamsChannelId: {
      type: 'string',
      maxLength: 50,
      nullable: true,
    },
    jiraSiteUrl: {
      type: 'string',
      maxLength: 500,
      nullable: true,
    },
    jiraProjectKey: {
      type: 'string',
      maxLength: 20,
      nullable: true,
    },
    jiraIssueType: {
      type: 'string',
      maxLength: 50,
      nullable: true,
    },
    servicenowInstanceUrl: {
      type: 'string',
      maxLength: 500,
      nullable: true,
    },
    servicenowTableName: {
      type: 'string',
      maxLength: 100,
      nullable: true,
    },
    webhookUrl: {
      type: 'string',
      maxLength: 2000,
      nullable: true,
    },
    webhookHeaders: {
      type: 'object',
      additionalProperties: { type: 'string' },
      nullable: true,
    },
    features: IntegrationFeaturesSchema,
    lastError: {
      type: 'string',
      nullable: true,
      description: 'Last error message',
    },
    lastErrorAt: {
      type: 'string',
      format: 'date-time',
      nullable: true,
    },
    errorCount: {
      type: 'integer',
      default: 0,
    },
    createdBy: {
      type: 'string',
      format: 'uuid',
      nullable: true,
    },
    createdAt: {
      type: 'string',
      format: 'date-time',
    },
    updatedAt: {
      type: 'string',
      format: 'date-time',
    },
  },
  required: ['id', 'orgId', 'type', 'name', 'status', 'features', 'createdAt', 'updatedAt'],
};

// --- Tag ---

export const TagSchema = {
  type: 'object',
  properties: {
    id: {
      type: 'string',
      format: 'uuid',
      description: 'Unique identifier for the tag',
    },
    orgId: {
      type: 'string',
      format: 'uuid',
      description: 'Organization ID this tag belongs to',
    },
    name: {
      type: 'string',
      maxLength: 100,
      description: 'Tag name',
      example: 'production',
    },
    color: {
      type: 'string',
      maxLength: 20,
      default: '#6b7280',
      description: 'Tag color in hex format',
      example: '#ef4444',
    },
    description: {
      type: 'string',
      nullable: true,
      description: 'Tag description',
    },
    usageCount: {
      type: 'integer',
      default: 0,
      description: 'Number of entities using this tag',
    },
    createdAt: {
      type: 'string',
      format: 'date-time',
    },
    updatedAt: {
      type: 'string',
      format: 'date-time',
    },
  },
  required: ['id', 'orgId', 'name', 'color', 'usageCount', 'createdAt', 'updatedAt'],
};

export const TagCreateSchema = {
  type: 'object',
  properties: {
    name: { type: 'string', maxLength: 100 },
    color: { type: 'string', maxLength: 20, default: '#6b7280' },
    description: { type: 'string', nullable: true },
  },
  required: ['name'],
};

// --- Team Member ---

export const TeamMemberSchema = {
  type: 'object',
  properties: {
    id: {
      type: 'string',
      format: 'uuid',
      description: 'Unique identifier for the team membership',
    },
    userId: {
      type: 'string',
      format: 'uuid',
      description: 'User ID of the team member',
    },
    role: {
      type: 'string',
      enum: ['manager', 'member'],
      description: 'Role of the member in the team',
    },
    user: {
      type: 'object',
      nullable: true,
      properties: {
        id: {
          type: 'string',
          format: 'uuid',
        },
        fullName: {
          type: 'string',
          nullable: true,
        },
        email: {
          type: 'string',
          format: 'email',
        },
      },
    },
    createdAt: {
      type: 'string',
      format: 'date-time',
      description: 'When the member was added to the team',
    },
  },
  required: ['id', 'userId', 'role'],
};

// --- Maintenance Window ---

export const MaintenanceWindowSchema = {
  type: 'object',
  properties: {
    id: {
      type: 'string',
      format: 'uuid',
      description: 'Unique identifier for the maintenance window',
    },
    serviceId: {
      type: 'string',
      format: 'uuid',
      description: 'Service this maintenance window applies to',
    },
    startTime: {
      type: 'string',
      format: 'date-time',
      description: 'Start time of the maintenance window',
    },
    endTime: {
      type: 'string',
      format: 'date-time',
      description: 'End time of the maintenance window',
    },
    description: {
      type: 'string',
      nullable: true,
      description: 'Description of the maintenance window',
    },
    suppressAlerts: {
      type: 'boolean',
      default: true,
      description: 'Whether to suppress alerts during maintenance',
    },
    createdBy: {
      type: 'string',
      format: 'uuid',
      description: 'User who created the maintenance window',
    },
    isActive: {
      type: 'boolean',
      description: 'Whether the maintenance window is currently active',
    },
    isFuture: {
      type: 'boolean',
      description: 'Whether the maintenance window is scheduled for the future',
    },
    hasEnded: {
      type: 'boolean',
      description: 'Whether the maintenance window has ended',
    },
    remainingTime: {
      type: 'integer',
      nullable: true,
      description: 'Remaining time in milliseconds if active',
    },
    duration: {
      type: 'string',
      description: 'Human-readable duration string',
    },
    createdAt: {
      type: 'string',
      format: 'date-time',
    },
    updatedAt: {
      type: 'string',
      format: 'date-time',
    },
  },
  required: ['id', 'serviceId', 'startTime', 'endTime', 'suppressAlerts', 'createdBy'],
};

export const MaintenanceWindowCreateSchema = {
  type: 'object',
  properties: {
    startTime: {
      type: 'string',
      format: 'date-time',
      description: 'Start time of the maintenance window (ISO 8601)',
    },
    endTime: {
      type: 'string',
      format: 'date-time',
      description: 'End time of the maintenance window (ISO 8601)',
    },
    description: {
      type: 'string',
      nullable: true,
      description: 'Description of the maintenance window',
    },
    suppressAlerts: {
      type: 'boolean',
      default: true,
      description: 'Whether to suppress alerts during maintenance',
    },
  },
  required: ['startTime', 'endTime'],
};

// --- Alert Grouping Rule ---

export const AlertGroupingRuleSchema = {
  type: 'object',
  properties: {
    id: {
      type: 'string',
      format: 'uuid',
      description: 'Unique identifier for the grouping rule',
    },
    serviceId: {
      type: 'string',
      format: 'uuid',
      description: 'Service this rule applies to',
    },
    groupingType: {
      type: 'string',
      enum: ['intelligent', 'time', 'content', 'disabled'],
      description: 'Type of alert grouping',
    },
    timeWindowMinutes: {
      type: 'integer',
      minimum: 1,
      maximum: 1440,
      default: 5,
      description: 'Time window in minutes for grouping',
    },
    contentFields: {
      type: 'array',
      items: { type: 'string' },
      description: 'Fields to use for content-based grouping',
    },
    dedupKeyTemplate: {
      type: 'string',
      nullable: true,
      description: 'Template for generating deduplication keys',
    },
    maxAlertsPerIncident: {
      type: 'integer',
      minimum: 1,
      maximum: 10000,
      default: 1000,
      description: 'Maximum alerts per incident',
    },
    description: {
      type: 'string',
      description: 'Human-readable description of the rule',
    },
    createdAt: {
      type: 'string',
      format: 'date-time',
    },
    updatedAt: {
      type: 'string',
      format: 'date-time',
    },
  },
  required: ['id', 'serviceId', 'groupingType'],
};

// --- Event Transform Rule ---

export const EventTransformRuleSchema = {
  type: 'object',
  properties: {
    id: {
      type: 'string',
      format: 'uuid',
      description: 'Unique identifier for the event transform rule',
    },
    serviceId: {
      type: 'string',
      format: 'uuid',
      description: 'Service this rule applies to',
    },
    name: {
      type: 'string',
      maxLength: 255,
      description: 'Rule name',
    },
    description: {
      type: 'string',
      nullable: true,
      description: 'Rule description',
    },
    ruleOrder: {
      type: 'integer',
      description: 'Order in which rules are evaluated',
    },
    enabled: {
      type: 'boolean',
      default: true,
      description: 'Whether the rule is enabled',
    },
    conditions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          field: { type: 'string' },
          operator: { type: 'string', enum: ['equals', 'contains', 'matches', 'exists', 'not_exists'] },
          value: { type: 'string' },
        },
      },
      description: 'Conditions that must match for the rule to apply',
    },
    matchType: {
      type: 'string',
      enum: ['all', 'any'],
      default: 'all',
      description: 'Whether all or any conditions must match',
    },
    transformations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['set', 'copy', 'delete', 'regex_extract'] },
          field: { type: 'string' },
          value: { type: 'string' },
          sourceField: { type: 'string' },
        },
      },
      description: 'Transformations to apply to the event',
    },
    action: {
      type: 'string',
      enum: ['continue', 'suppress', 'route'],
      default: 'continue',
      description: 'Action to take after applying transformations',
    },
    routeToServiceId: {
      type: 'string',
      format: 'uuid',
      nullable: true,
      description: 'Service to route event to (if action is route)',
    },
    routeToService: {
      type: 'object',
      nullable: true,
      properties: {
        id: { type: 'string', format: 'uuid' },
        name: { type: 'string' },
      },
    },
    eventsMatched: {
      type: 'integer',
      default: 0,
      description: 'Number of events matched by this rule',
    },
    lastMatchedAt: {
      type: 'string',
      format: 'date-time',
      nullable: true,
      description: 'When an event last matched this rule',
    },
    createdBy: {
      type: 'string',
      format: 'uuid',
      description: 'User who created this rule',
    },
    createdAt: {
      type: 'string',
      format: 'date-time',
    },
    updatedAt: {
      type: 'string',
      format: 'date-time',
    },
  },
  required: ['id', 'serviceId', 'name', 'ruleOrder', 'enabled', 'conditions', 'matchType', 'transformations', 'action'],
};

// ============================================================================
// Export all schemas as a single object for swagger.ts
// ============================================================================

export const modelSchemas = {
  // Common responses
  Pagination: PaginationSchema,
  Error: ErrorSchema,
  UnauthorizedError: UnauthorizedErrorSchema,
  ForbiddenError: ForbiddenErrorSchema,
  NotFoundError: NotFoundErrorSchema,
  ValidationError: ValidationErrorSchema,

  // Tier 1: Core resources
  Team: TeamSchema,
  TeamCreate: TeamCreateSchema,
  TeamUpdate: TeamUpdateSchema,
  TeamSettings: TeamSettingsSchema,

  User: UserSchema,
  UserCreate: UserCreateSchema,
  UserUpdate: UserUpdateSchema,

  Service: ServiceSchema,
  ServiceCreate: ServiceCreateSchema,
  ServiceUpdate: ServiceUpdateSchema,
  SupportHours: SupportHoursSchema,
  ServiceExternalKeys: ServiceExternalKeysSchema,

  EscalationPolicy: EscalationPolicySchema,
  EscalationPolicyCreate: EscalationPolicyCreateSchema,
  EscalationPolicyUpdate: EscalationPolicyUpdateSchema,
  EscalationStep: EscalationStepSchema,
  EscalationStepCreate: EscalationStepCreateSchema,

  Schedule: ScheduleSchema,
  ScheduleCreate: ScheduleCreateSchema,
  ScheduleUpdate: ScheduleUpdateSchema,
  ScheduleLayer: ScheduleLayerSchema,
  ScheduleLayerCreate: ScheduleLayerCreateSchema,
  ScheduleLayerMember: ScheduleLayerMemberSchema,
  ScheduleMember: ScheduleMemberSchema,
  LayerRestrictions: LayerRestrictionsSchema,

  // Tier 2: Additional resources
  Incident: IncidentSchema,
  Notification: NotificationSchema,
  Runbook: RunbookSchema,
  RunbookCreate: RunbookCreateSchema,
  RunbookStep: RunbookStepSchema,
  Integration: IntegrationSchema,
  IntegrationFeatures: IntegrationFeaturesSchema,
  Tag: TagSchema,
  TagCreate: TagCreateSchema,

  // Team membership
  TeamMember: TeamMemberSchema,

  // Service-related
  MaintenanceWindow: MaintenanceWindowSchema,
  MaintenanceWindowCreate: MaintenanceWindowCreateSchema,
  AlertGroupingRule: AlertGroupingRuleSchema,
  EventTransformRule: EventTransformRuleSchema,
};
