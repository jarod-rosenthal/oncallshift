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
}

// Available actions that can be assigned to services
export const AVAILABLE_ACTIONS: ActionTemplate[] = [
  {
    id: 'restart-pods',
    label: 'Restart Pods',
    description: 'Restart all pods in the deployment to reset connections',
    icon: 'restart',
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
    icon: 'arrow-up-bold',
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
    icon: 'undo-variant',
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
    icon: 'delete-sweep',
    estimatedMinutes: 1,
    endpoint: '/api/v1/actions/clear-cache',
    method: 'POST',
  },
  {
    id: 'rate-limit',
    label: 'Enable Rate Limiting',
    description: 'Enable rate limiting to protect against traffic spikes',
    icon: 'shield-check',
    estimatedMinutes: 1,
    endpoint: '/api/v1/actions/rate-limit',
    method: 'POST',
    defaultBody: { enabled: true, rps: 100 },
    confirmMessage: 'Enable rate limiting at 100 RPS?',
  },
  {
    id: 'flush-pgbouncer',
    label: 'Reset DB Connections',
    description: 'Flush connection pool to reset stuck connections',
    icon: 'connection',
    estimatedMinutes: 1,
    endpoint: '/api/v1/actions/flush-pgbouncer',
    method: 'POST',
    confirmMessage: 'This will reset all database connections. Continue?',
  },
  {
    id: 'kill-queries',
    label: 'Kill Slow Queries',
    description: 'Terminate database queries running longer than threshold',
    icon: 'lightning-bolt',
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
    icon: 'traffic-cone',
    estimatedMinutes: 1,
    endpoint: '/api/v1/actions/traffic-shed',
    method: 'POST',
    defaultBody: { percentage: 10 },
    confirmMessage: 'This will drop 10% of traffic. Continue?',
  },
];

// Pre-built service templates
export const SERVICE_TEMPLATES: ServiceTemplate[] = [
  {
    id: 'api',
    name: 'API Service',
    description: 'REST or GraphQL API endpoints',
    icon: 'api',
    category: 'compute',
    defaultActions: [
      AVAILABLE_ACTIONS.find(a => a.id === 'restart-pods')!,
      AVAILABLE_ACTIONS.find(a => a.id === 'scale-up')!,
      AVAILABLE_ACTIONS.find(a => a.id === 'rollback')!,
      AVAILABLE_ACTIONS.find(a => a.id === 'rate-limit')!,
    ],
  },
  {
    id: 'web',
    name: 'Web Application',
    description: 'Frontend web application or SPA',
    icon: 'web',
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
    description: 'PostgreSQL, MySQL, or MongoDB',
    icon: 'database',
    category: 'data',
    defaultActions: [
      AVAILABLE_ACTIONS.find(a => a.id === 'flush-pgbouncer')!,
      AVAILABLE_ACTIONS.find(a => a.id === 'kill-queries')!,
      AVAILABLE_ACTIONS.find(a => a.id === 'clear-cache')!,
    ],
  },
  {
    id: 'queue',
    name: 'Queue Worker',
    description: 'Background job processor',
    icon: 'tray-full',
    category: 'compute',
    defaultActions: [
      AVAILABLE_ACTIONS.find(a => a.id === 'restart-pods')!,
      AVAILABLE_ACTIONS.find(a => a.id === 'scale-up')!,
      AVAILABLE_ACTIONS.find(a => a.id === 'clear-cache')!,
    ],
  },
  {
    id: 'auth',
    name: 'Auth Service',
    description: 'Authentication & authorization',
    icon: 'shield-lock',
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
    description: 'Payment processing & billing',
    icon: 'credit-card',
    category: 'compute',
    defaultActions: [
      AVAILABLE_ACTIONS.find(a => a.id === 'restart-pods')!,
      AVAILABLE_ACTIONS.find(a => a.id === 'rollback')!,
      AVAILABLE_ACTIONS.find(a => a.id === 'rate-limit')!,
    ],
  },
];

// Build runbook steps from selected actions
export function buildRunbookSteps(actions: ActionTemplate[]): Array<{
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
  return actions.map((action, index) => ({
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
      body: action.defaultBody,
      confirmMessage: action.confirmMessage,
    },
  }));
}
