/**
 * Shared component prop type definitions for the frontend application.
 *
 * This module provides a single source of truth for component prop interfaces,
 * enabling better type safety and consistency across the application.
 *
 * @module components/types
 */

/**
 * Size variants for components
 */
export type SizeVariant = 'sm' | 'md' | 'lg';

/**
 * Common component size variant configuration
 */
export const sizeVariants = {
  sm: 'sm',
  md: 'md',
  lg: 'lg',
} as const;

/**
 * Props for SeverityBadge component
 *
 * @example
 * <SeverityBadge severity="critical" size="md" showIcon={true} />
 */
export interface SeverityBadgeProps {
  /** The severity level: critical, error, warning, info, or low */
  severity: string;
  /** Size variant for the badge */
  size?: SizeVariant;
  /** Whether to show the severity icon */
  showIcon?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Props for StateBadge component
 *
 * @example
 * <StateBadge state="triggered" size="md" />
 */
export interface StateBadgeProps {
  /** The incident state: triggered, acknowledged, resolved */
  state: string;
  /** Size variant for the badge */
  size?: SizeVariant;
  /** Whether to show the state icon */
  showIcon?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Props for MetricsCard component
 *
 * @example
 * <MetricsCard incidents={incidents} />
 */
export interface MetricsCardProps {
  /** Array of incidents to calculate metrics from */
  incidents: import('../types/api').Incident[];
  /** Additional CSS classes */
  className?: string;
}

/**
 * Props for IncidentCard component
 *
 * @example
 * <IncidentCard
 *   incident={incident}
 *   onAcknowledge={() => handleAcknowledge()}
 *   onResolve={() => handleResolve()}
 * />
 */
export interface IncidentCardProps {
  /** The incident data to display */
  incident: Record<string, any>;
  /** Callback when user acknowledges the incident */
  onAcknowledge?: () => void;
  /** Callback when user resolves the incident */
  onResolve?: () => void;
  /** Callback when user escalates the incident */
  onEscalate?: () => void;
  /** Whether the card is in read-only mode */
  readOnly?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Props for Badge component
 *
 * @example
 * <Badge variant="default">New</Badge>
 * <Badge variant="secondary">In Progress</Badge>
 */
export interface BadgeProps {
  /** Badge variant style */
  variant?: 'default' | 'secondary' | 'destructive' | 'outline';
  /** Badge content */
  children: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Props for status-related badge components
 */
export interface StatusBadgeProps extends BadgeProps {
  /** The status value */
  status: string;
  /** Optional icon to display alongside status */
  icon?: React.ReactNode;
  /** Whether the status is active/healthy */
  isActive?: boolean;
}

/**
 * Props for button components with various styles
 *
 * @example
 * <Button variant="primary" size="md">Click me</Button>
 */
export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Button style variant */
  variant?:
    | 'default'
    | 'destructive'
    | 'secondary'
    | 'outline'
    | 'ghost'
    | 'link'
    | 'success';
  /** Button size */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Whether the button is in a loading state */
  isLoading?: boolean;
  /** Whether the button is disabled */
  disabled?: boolean;
  /** Icon to show before text */
  icon?: React.ReactNode;
  /** Icon to show after text */
  iconRight?: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Props for input field components
 *
 * @example
 * <Input
 *   type="text"
 *   placeholder="Enter your name"
 *   onChange={(e) => setName(e.target.value)}
 * />
 */
export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Input label */
  label?: string;
  /** Error message to display */
  error?: string;
  /** Helper text below the input */
  helperText?: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Props for select/dropdown components
 *
 * @example
 * <Select
 *   label="Choose severity"
 *   options={[
 *     { value: 'critical', label: 'Critical' },
 *     { value: 'high', label: 'High' }
 *   ]}
 * />
 */
export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  /** Select label */
  label?: string;
  /** Available options */
  options?: Array<{
    value: string;
    label: string;
    disabled?: boolean;
  }>;
  /** Error message */
  error?: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Props for card container components
 *
 * @example
 * <Card>
 *   <CardHeader>Title</CardHeader>
 *   <CardContent>Content here</CardContent>
 * </Card>
 */
export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Card content */
  children: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
  /** Whether to show a border */
  bordered?: boolean;
  /** Whether to show a shadow */
  shadowed?: boolean;
}

/**
 * Props for dialog/modal components
 *
 * @example
 * <Dialog open={isOpen} onOpenChange={setIsOpen}>
 *   <DialogContent>Modal content</DialogContent>
 * </Dialog>
 */
export interface DialogProps {
  /** Whether the dialog is open */
  open?: boolean;
  /** Callback when dialog open state changes */
  onOpenChange?: (open: boolean) => void;
  /** Dialog title */
  title?: string;
  /** Dialog content */
  children: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Props for switch/toggle components
 *
 * @example
 * <Switch
 *   checked={isEnabled}
 *   onChange={(checked) => setIsEnabled(checked)}
 *   label="Enable notifications"
 * />
 */
export interface SwitchProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  /** Whether the switch is checked */
  checked?: boolean;
  /** Callback when switch state changes */
  onChange?: (checked: boolean) => void;
  /** Label for the switch */
  label?: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Common props for all badge-like components
 */
export interface BadgeLikeComponentProps {
  /** CSS classes for styling */
  className?: string;
  /** Test ID for testing */
  testId?: string;
}

/**
 * Icon component props
 */
export interface IconProps extends React.SVGAttributes<SVGSVGElement> {
  /** Icon size */
  size?: SizeVariant | number;
  /** Icon color */
  color?: string;
  /** Icon stroke width */
  strokeWidth?: number;
}

/**
 * Props for avatar/profile picture components
 *
 * @example
 * <Avatar
 *   src={imageUrl}
 *   alt="User name"
 *   size="md"
 *   fallback="JD"
 * />
 */
export interface AvatarProps {
  /** Image source URL */
  src?: string;
  /** Alternative text for image */
  alt?: string;
  /** Avatar size */
  size?: SizeVariant | number;
  /** Fallback text when no image available */
  fallback?: string;
  /** Whether to show a border around avatar */
  bordered?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Props for loading/skeleton placeholder components
 */
export interface SkeletonProps {
  /** Number of lines to show for text skeleton */
  lines?: number;
  /** Width of the skeleton */
  width?: string | number;
  /** Height of the skeleton */
  height?: string | number;
  /** Whether to show animation */
  animated?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Props for empty state components
 *
 * @example
 * <EmptyState
 *   title="No incidents"
 *   description="You're all set!"
 *   icon={<CheckIcon />}
 * />
 */
export interface EmptyStateProps {
  /** Title for the empty state */
  title: string;
  /** Description or longer message */
  description?: string;
  /** Icon to display */
  icon?: React.ReactNode;
  /** Action button configuration */
  action?: {
    label: string;
    onClick: () => void;
  };
  /** Additional CSS classes */
  className?: string;
}

/**
 * Props for pagination components
 *
 * @example
 * <Pagination
 *   currentPage={1}
 *   totalPages={10}
 *   onPageChange={(page) => setPage(page)}
 * />
 */
export interface PaginationProps {
  /** Current page number (1-indexed) */
  currentPage: number;
  /** Total number of pages */
  totalPages: number;
  /** Items per page */
  itemsPerPage?: number;
  /** Callback when page changes */
  onPageChange: (page: number) => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Props for list/table wrapper components
 */
export interface ListProps extends React.HTMLAttributes<HTMLUListElement> {
  /** Whether the list is empty */
  isEmpty?: boolean;
  /** Loading state */
  isLoading?: boolean;
  /** List items */
  children: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Props for toolbar/action bar components
 */
export interface ToolbarProps {
  /** Actions available in the toolbar */
  actions: Array<{
    label: string;
    icon?: React.ReactNode;
    onClick: () => void;
    disabled?: boolean;
    variant?: 'default' | 'destructive' | 'secondary';
  }>;
  /** Additional CSS classes */
  className?: string;
}
