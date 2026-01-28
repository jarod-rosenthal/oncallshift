/**
 * Barrel exports for all frontend components
 *
 * This is the main export point for all components in the frontend application.
 * It provides organized access to components grouped by category.
 *
 * @example
 * // Import incident components
 * import { IncidentCard, SeverityBadge } from '@/components';
 *
 * // Import UI components
 * import { Button, Card } from '@/components/ui';
 *
 * // Import layout components
 * import { Container, PageHeader } from '@/components/layout';
 */

// ============================================================================
// Incident Components
// ============================================================================
export { IncidentCard, SeverityBadge, StateBadge, MetricsCard } from './incidents';
export type { IncidentCardProps, SeverityBadgeProps, StateBadgeProps, MetricsCardProps } from './types';

// ============================================================================
// Layout Components
// ============================================================================
export { Container, PageHeader, Section } from './layout';

// ============================================================================
// UI Components
// ============================================================================
export {
  Button,
  Card,
  Badge,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Input,
  Label,
  Select,
  Switch,
  BulkActionBar,
  FilterChip,
  StatusBadge,
  ThemeSwitcher,
  ScheduleTimeline,
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from './ui';

// ============================================================================
// Page-level Components
// ============================================================================
export { Header } from './Header';
export { Navigation } from './Navigation';
export { AppLayout } from './AppLayout';
export { ErrorBoundary } from './ErrorBoundary';
export { SuperAdminRoute } from './SuperAdminRoute';
export { AdminRoute } from './AdminRoute';

// ============================================================================
// Feature Components
// ============================================================================
export { PostmortemPanel } from './PostmortemPanel';
export { ResolveModal } from './ResolveModal';
export { StickyActionBar } from './StickyActionBar';
export { SimilarIncidentHint } from './SimilarIncidentHint';
export { UserAvatar } from './UserAvatar';
export { ProfilePictureEditor } from './ProfilePictureEditor';
export { ExecutionMonitor } from './ExecutionMonitor';
export { RunbookAutomationPanel } from './RunbookAutomationPanel';
export { Toast } from './Toast';
export { EmptyState } from './EmptyState';
export { WeeklyCalendar } from './WeeklyCalendar';
export { SupportHoursConfig } from './SupportHoursConfig';

// ============================================================================
// Documentation Components
// ============================================================================
export {
  DocsLayout,
  DocsSidebar,
  DocsContent,
  Callout,
  StepList,
  Screenshot,
  RelatedPages,
  FeedbackWidget,
} from './docs';

// ============================================================================
// Type Exports
// ============================================================================
export type {
  SizeVariant,
  SeverityBadgeProps,
  StateBadgeProps,
  MetricsCardProps,
  IncidentCardProps,
  BadgeProps,
  StatusBadgeProps,
  ButtonProps,
  InputProps,
  SelectProps,
  CardProps,
  DialogProps,
  SwitchProps,
  BadgeLikeComponentProps,
  IconProps,
  AvatarProps,
  SkeletonProps,
  EmptyStateProps,
  PaginationProps,
  ListProps,
  ToolbarProps,
} from './types';
