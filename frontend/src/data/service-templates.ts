// Service templates with pre-built runbooks for the setup wizard

export interface ActionTemplate {
  id: string;
  label: string;
  description: string;
  icon: string;
  estimatedMinutes: number;
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  defaultBody?: Record<string, unknown>;
  confirmMessage?: string;
}

export interface ServiceTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'compute' | 'data' | 'infrastructure' | 'security';
  defaultActions: ActionTemplate[];
  severityMapping?: Record<string, string>;
}

// Available actions that can be assigned to services
export const AVAILABLE_ACTIONS: ActionTemplate[] = [
  {
    id: 'restart-pods',
    label: 'Restart Pods',
    description: 'Restart all pods in the deployment to reset connections',
    icon: '🔄',
    estimatedMinutes: 2,
    endpoint: '/api/v1/actions/restart-pods',
    method: 'POST',
    defaultBody: { deployment: 'default', namespace: 'production' },
    confirmMessage: 'This will restart all pods. Continue?',
  },
  {
    id: 'scale-up',
    label: 'Scale Up',
    description: 'Increase replicas to handle more load',
    icon: '⬆️',
    estimatedMinutes: 1,
    endpoint: '/api/v1/actions/scale-deployment',
    method: 'POST',
    defaultBody: { deployment: 'default', replicas: 5 },
    confirmMessage: 'Scale deployment to 5 replicas?',
  },
  {
    id: 'rollback',
    label: 'Rollback',
    description: 'Rollback to the previous stable version',
    icon: '⏪',
    estimatedMinutes: 2,
    endpoint: '/api/v1/actions/rollback',
    method: 'POST',
    defaultBody: { deployment: 'default' },
    confirmMessage: 'This will rollback to the previous version. Continue?',
  },
  {
    id: 'clear-cache',
    label: 'Clear Cache',
    description: 'Clear application cache to fix stale data issues',
    icon: '🗑️',
    estimatedMinutes: 1,
    endpoint: '/api/v1/actions/clear-cache',
    method: 'POST',
  },
  {
    id: 'rate-limit',
    label: 'Enable Rate Limiting',
    description: 'Enable rate limiting to protect against traffic spikes',
    icon: '🛡️',
    estimatedMinutes: 1,
    endpoint: '/api/v1/actions/rate-limit',
    method: 'POST',
    defaultBody: { enabled: true, rps: 100 },
    confirmMessage: 'Enable rate limiting at 100 RPS?',
  },
  {
    id: 'flush-pgbouncer',
    label: 'Reset DB Connections',
    description: 'Flush PgBouncer connection pool to reset stuck connections',
    icon: '🔌',
    estimatedMinutes: 1,
    endpoint: '/api/v1/actions/flush-pgbouncer',
    method: 'POST',
    confirmMessage: 'This will reset all database connections. Continue?',
  },
  {
    id: 'kill-queries',
    label: 'Kill Slow Queries',
    description: 'Terminate database queries running longer than threshold',
    icon: '⚡',
    estimatedMinutes: 1,
    endpoint: '/api/v1/actions/kill-queries',
    method: 'POST',
    defaultBody: { threshold_seconds: 30 },
    confirmMessage: 'Kill queries running longer than 30s?',
  },
  {
    id: 'traffic-shed',
    label: 'Shed Traffic',
    description: 'Drop a percentage of traffic to relieve system pressure',
    icon: '🚧',
    estimatedMinutes: 1,
    endpoint: '/api/v1/actions/traffic-shed',
    method: 'POST',
    defaultBody: { percentage: 10 },
    confirmMessage: 'This will drop 10% of traffic. Continue?',
  },
  {
    id: 'rotate-logs',
    label: 'Rotate Logs',
    description: 'Force log rotation to free disk space',
    icon: '📋',
    estimatedMinutes: 2,
    endpoint: '/api/v1/actions/rotate-logs',
    method: 'POST',
  },
  {
    id: 'clear-temp',
    label: 'Clear Temp Files',
    description: 'Remove temporary files to free disk space',
    icon: '🧹',
    estimatedMinutes: 2,
    endpoint: '/api/v1/actions/clear-temp',
    method: 'POST',
    defaultBody: { older_than_hours: 24 },
  },
  {
    id: 'docker-prune',
    label: 'Docker Cleanup',
    description: 'Remove unused Docker images and containers',
    icon: '🐳',
    estimatedMinutes: 3,
    endpoint: '/api/v1/actions/docker-prune',
    method: 'POST',
    confirmMessage: 'This will remove unused Docker resources. Continue?',
  },
];

// Pre-built service templates
export const SERVICE_TEMPLATES: ServiceTemplate[] = [
  {
    id: 'api',
    name: 'API Service',
    description: 'REST or GraphQL API endpoints',
    icon: '🔌',
    category: 'compute',
    defaultActions: [
      AVAILABLE_ACTIONS.find(a => a.id === 'restart-pods')!,
      AVAILABLE_ACTIONS.find(a => a.id === 'scale-up')!,
      AVAILABLE_ACTIONS.find(a => a.id === 'rollback')!,
      AVAILABLE_ACTIONS.find(a => a.id === 'rate-limit')!,
    ],
    severityMapping: {
      '5xx_rate > 10%': 'critical',
      '5xx_rate > 5%': 'error',
      'latency_p99 > 2s': 'warning',
    },
  },
  {
    id: 'web',
    name: 'Web Application',
    description: 'Frontend web application or SPA',
    icon: '🌐',
    category: 'compute',
    defaultActions: [
      AVAILABLE_ACTIONS.find(a => a.id === 'restart-pods')!,
      AVAILABLE_ACTIONS.find(a => a.id === 'clear-cache')!,
      AVAILABLE_ACTIONS.find(a => a.id === 'rollback')!,
    ],
  },
  {
    id: 'database',
    name: 'Database Service',
    description: 'PostgreSQL, MySQL, or MongoDB database',
    icon: '🗄️',
    category: 'data',
    defaultActions: [
      AVAILABLE_ACTIONS.find(a => a.id === 'flush-pgbouncer')!,
      AVAILABLE_ACTIONS.find(a => a.id === 'kill-queries')!,
      AVAILABLE_ACTIONS.find(a => a.id === 'clear-cache')!,
    ],
    severityMapping: {
      'connection_count > 90%': 'critical',
      'replication_lag > 30s': 'error',
      'slow_queries > 50': 'warning',
    },
  },
  {
    id: 'queue',
    name: 'Queue Worker',
    description: 'Background job processor (SQS, RabbitMQ, Redis)',
    icon: '📦',
    category: 'compute',
    defaultActions: [
      AVAILABLE_ACTIONS.find(a => a.id === 'restart-pods')!,
      AVAILABLE_ACTIONS.find(a => a.id === 'scale-up')!,
      AVAILABLE_ACTIONS.find(a => a.id === 'clear-cache')!,
    ],
    severityMapping: {
      'queue_depth > 10000': 'critical',
      'queue_depth > 1000': 'warning',
      'processing_time > 60s': 'warning',
    },
  },
  {
    id: 'auth',
    name: 'Auth Service',
    description: 'Authentication and authorization service',
    icon: '🔐',
    category: 'security',
    defaultActions: [
      AVAILABLE_ACTIONS.find(a => a.id === 'restart-pods')!,
      AVAILABLE_ACTIONS.find(a => a.id === 'clear-cache')!,
      AVAILABLE_ACTIONS.find(a => a.id === 'rate-limit')!,
    ],
  },
  {
    id: 'payment',
    name: 'Payment Service',
    description: 'Payment processing and billing',
    icon: '💳',
    category: 'compute',
    defaultActions: [
      AVAILABLE_ACTIONS.find(a => a.id === 'restart-pods')!,
      AVAILABLE_ACTIONS.find(a => a.id === 'rollback')!,
      AVAILABLE_ACTIONS.find(a => a.id === 'rate-limit')!,
    ],
  },
  {
    id: 'storage',
    name: 'Storage Service',
    description: 'File storage (S3, GCS, Azure Blob)',
    icon: '💾',
    category: 'infrastructure',
    defaultActions: [
      AVAILABLE_ACTIONS.find(a => a.id === 'clear-temp')!,
      AVAILABLE_ACTIONS.find(a => a.id === 'rotate-logs')!,
    ],
  },
  {
    id: 'kubernetes',
    name: 'Kubernetes Cluster',
    description: 'Container orchestration infrastructure',
    icon: '☸️',
    category: 'infrastructure',
    defaultActions: [
      AVAILABLE_ACTIONS.find(a => a.id === 'docker-prune')!,
      AVAILABLE_ACTIONS.find(a => a.id === 'clear-temp')!,
      AVAILABLE_ACTIONS.find(a => a.id === 'rotate-logs')!,
    ],
  },
];

// Get action by ID
export function getActionById(id: string): ActionTemplate | undefined {
  return AVAILABLE_ACTIONS.find(a => a.id === id);
}

// Get template by ID
export function getTemplateById(id: string): ServiceTemplate | undefined {
  return SERVICE_TEMPLATES.find(t => t.id === id);
}

// Build runbook steps from selected actions
export function buildRunbookSteps(
  actions: ActionTemplate[],
  serviceConfig?: { deployment?: string; namespace?: string }
): Array<{
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
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    body?: Record<string, unknown>;
    confirmMessage?: string;
  };
}> {
  return actions.map((action, index) => {
    // Merge default body with service-specific config
    let body = action.defaultBody ? { ...action.defaultBody } : undefined;
    if (body && serviceConfig) {
      if (serviceConfig.deployment && 'deployment' in body) {
        body.deployment = serviceConfig.deployment;
      }
      if (serviceConfig.namespace && 'namespace' in body) {
        body.namespace = serviceConfig.namespace;
      }
    }

    return {
      id: `step-${action.id}`,
      order: index + 1,
      title: action.label,
      description: action.description,
      isOptional: false,
      estimatedMinutes: action.estimatedMinutes,
      action: {
        type: 'webhook' as const,
        label: action.label,
        url: action.endpoint,
        method: action.method,
        body,
        confirmMessage: action.confirmMessage,
      },
    };
  });
}
