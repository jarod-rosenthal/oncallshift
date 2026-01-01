import type { ReactNode } from 'react';
import {
  Inbox,
  Calendar,
  Bell,
  Users,
  Settings,
  Search,
  WifiOff,
  AlertTriangle,
  CheckCircle,
  FolderOpen,
  FileText,
  Shield,
  Clock,
} from 'lucide-react';
import { Button } from './ui/button';

type EmptyStatePreset =
  | 'no-incidents'
  | 'no-incidents-resolved'
  | 'no-schedules'
  | 'no-escalation-policies'
  | 'no-users'
  | 'no-teams'
  | 'no-services'
  | 'no-runbooks'
  | 'no-notifications'
  | 'no-results'
  | 'offline'
  | 'error'
  | 'no-data'
  | 'no-integrations';

interface PresetConfig {
  icon: ReactNode;
  title: string;
  description: string;
}

const presets: Record<EmptyStatePreset, PresetConfig> = {
  'no-incidents': {
    icon: <CheckCircle className="h-12 w-12 text-green-500" />,
    title: 'All clear!',
    description: 'No active incidents. Your systems are running smoothly.',
  },
  'no-incidents-resolved': {
    icon: <Inbox className="h-12 w-12 text-muted-foreground" />,
    title: 'No resolved incidents',
    description: 'Resolved incidents will appear here.',
  },
  'no-schedules': {
    icon: <Calendar className="h-12 w-12 text-muted-foreground" />,
    title: 'No schedules yet',
    description: 'Create your first on-call schedule to get started.',
  },
  'no-escalation-policies': {
    icon: <Shield className="h-12 w-12 text-muted-foreground" />,
    title: 'No escalation policies',
    description: 'Set up escalation policies to define how incidents are routed.',
  },
  'no-users': {
    icon: <Users className="h-12 w-12 text-muted-foreground" />,
    title: 'No team members',
    description: 'Invite team members to collaborate on incident response.',
  },
  'no-teams': {
    icon: <Users className="h-12 w-12 text-muted-foreground" />,
    title: 'No teams',
    description: 'Create teams to organize your on-call responders.',
  },
  'no-services': {
    icon: <Settings className="h-12 w-12 text-muted-foreground" />,
    title: 'No services',
    description: 'Add services to start receiving alerts.',
  },
  'no-runbooks': {
    icon: <FileText className="h-12 w-12 text-muted-foreground" />,
    title: 'No runbooks',
    description: 'Create runbooks to document incident response procedures.',
  },
  'no-notifications': {
    icon: <Bell className="h-12 w-12 text-muted-foreground" />,
    title: 'No notifications',
    description: 'Notification history will appear here.',
  },
  'no-results': {
    icon: <Search className="h-12 w-12 text-muted-foreground" />,
    title: 'No results found',
    description: 'Try adjusting your search or filters.',
  },
  'offline': {
    icon: <WifiOff className="h-12 w-12 text-muted-foreground" />,
    title: 'You\'re offline',
    description: 'Check your internet connection and try again.',
  },
  'error': {
    icon: <AlertTriangle className="h-12 w-12 text-red-500" />,
    title: 'Something went wrong',
    description: 'We couldn\'t load this content. Please try again.',
  },
  'no-data': {
    icon: <FolderOpen className="h-12 w-12 text-muted-foreground" />,
    title: 'No data',
    description: 'There\'s nothing here yet.',
  },
  'no-integrations': {
    icon: <Clock className="h-12 w-12 text-muted-foreground" />,
    title: 'No integrations',
    description: 'Connect your monitoring tools to start receiving alerts.',
  },
};

interface EmptyStateProps {
  preset?: EmptyStatePreset;
  icon?: ReactNode;
  title?: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({
  preset,
  icon,
  title,
  description,
  action,
  className = '',
}: EmptyStateProps) {
  const config = preset ? presets[preset] : null;

  const displayIcon = icon || config?.icon || <FolderOpen className="h-12 w-12 text-muted-foreground" />;
  const displayTitle = title || config?.title || 'No data';
  const displayDescription = description || config?.description || 'There\'s nothing here yet.';

  return (
    <div className={`flex flex-col items-center justify-center py-12 px-4 text-center ${className}`}>
      <div className="mb-4 opacity-80">{displayIcon}</div>
      <h3 className="text-lg font-semibold text-foreground mb-2">{displayTitle}</h3>
      <p className="text-sm text-muted-foreground max-w-sm mb-6">{displayDescription}</p>
      {action && (
        <Button onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
