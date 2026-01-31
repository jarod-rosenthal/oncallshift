/**
 * Shared component prop type definitions for the mobile application.
 *
 * This module provides a single source of truth for component prop interfaces,
 * enabling better type safety and consistency across the mobile app.
 *
 * @module components/types
 */

import type { Incident } from '../services/apiService';

/**
 * Size variants for mobile components
 */
export type SizeVariant = 'sm' | 'md' | 'lg';

/**
 * Props for IncidentCard component
 *
 * @example
 * <IncidentCard
 *   incident={incident}
 *   onPress={(incident) => navigation.navigate('Details', { incident })}
 *   onAcknowledge={(incident) => handleAcknowledge(incident)}
 * />
 */
export interface IncidentCardProps {
  /** The incident data to display */
  incident: Incident;
  /** Callback when the card is pressed */
  onPress: (incident: Incident) => void;
  /** Callback when user acknowledges the incident */
  onAcknowledge?: (incident: Incident) => void;
  /** Callback when user resolves the incident */
  onResolve?: (incident: Incident) => void;
  /** Whether the app is in selection mode for bulk actions */
  isSelectionMode?: boolean;
  /** Whether this specific incident is selected */
  isSelected?: boolean;
  /** Callback to toggle selection of this incident */
  onToggleSelection?: (id: string) => void;
  /** Callback on long press */
  onLongPress?: (incident: Incident) => void;
  /** Whether swipe actions are enabled */
  swipeEnabled?: boolean;
  /** Whether to show quick action buttons */
  showQuickActions?: boolean;
  /** Minutes before incident escalates */
  escalationTimeoutMinutes?: number;
  /** Minutes to highlight as urgent */
  urgencyThresholdMinutes?: number;
}

/**
 * Props for EscalationBadge component
 *
 * @example
 * <EscalationBadge escalatesAt={new Date()} />
 */
export interface EscalationBadgeProps {
  /** ISO timestamp when escalation will occur */
  escalatesAt: string | Date;
  /** Text size for the badge */
  textSize?: 'xs' | 'sm' | 'md' | 'lg';
  /** Custom styling */
  style?: Record<string, any>;
  /** Test ID for testing */
  testID?: string;
}

/**
 * Props for UrgencyIndicator component
 */
export interface UrgencyIndicatorProps {
  /** ISO timestamp when incident was triggered */
  triggeredAt: string | Date;
  /** Minutes to consider as urgent (default 30) */
  urgencyThresholdMinutes?: number;
  /** Whether to show icon */
  showIcon?: boolean;
  /** Text size */
  textSize?: 'xs' | 'sm' | 'md' | 'lg';
  /** Custom styling */
  style?: Record<string, any>;
}

/**
 * Props for OwnerAvatar component
 *
 * @example
 * <OwnerAvatar
 *   name="John Doe"
 *   email="john@example.com"
 *   profilePictureUrl="https://..."
 *   size={40}
 * />
 */
export interface OwnerAvatarProps {
  /** User's full name */
  name: string;
  /** User's email address */
  email?: string;
  /** URL to profile picture */
  profilePictureUrl?: string;
  /** Avatar size in pixels */
  size?: number;
  /** Whether to show name next to avatar */
  showName?: boolean;
  /** Custom styling */
  style?: Record<string, any>;
  /** Test ID */
  testID?: string;
}

/**
 * Props for RespondersSection component
 */
export interface RespondersSectionProps {
  /** Array of responders */
  responders: Array<{
    id: string;
    name: string;
    email?: string;
    profilePictureUrl?: string;
    status?: 'acknowledged' | 'assigned' | 'on_call';
  }>;
  /** Title for the section */
  title?: string;
  /** Maximum responders to show before "more" indicator */
  maxVisible?: number;
  /** Callback when section is pressed */
  onPress?: () => void;
  /** Custom styling */
  style?: Record<string, any>;
}

/**
 * Props for EmptyState component
 *
 * @example
 * <EmptyState
 *   preset="no-incidents"
 *   action={{
 *     label: "Create Incident",
 *     onPress: () => navigation.navigate('CreateIncident')
 *   }}
 * />
 */
export interface EmptyStateProps {
  /** Preset configuration key */
  preset?: string;
  /** Custom title */
  title?: string;
  /** Custom description */
  description?: string;
  /** Action button configuration */
  action?: {
    label: string;
    onPress: () => void;
  };
  /** Custom styling */
  style?: Record<string, any>;
}

/**
 * Props for ActionToast component
 */
export interface ActionToastProps {
  /** Toast message text */
  message: string;
  /** Toast type: success, error, info, warning */
  type?: 'success' | 'error' | 'info' | 'warning';
  /** Duration to show toast (ms) */
  duration?: number;
  /** Action button configuration */
  action?: {
    label: string;
    onPress: () => void;
  };
  /** Whether toast is visible */
  visible?: boolean;
  /** Callback when toast is dismissed */
  onDismiss?: () => void;
}

/**
 * Props for FilterPanel component
 */
export interface FilterPanelProps {
  /** Current filter state */
  state: FilterState;
  /** Callback when filters change */
  onChange: (state: FilterState) => void;
  /** Available severity options */
  severityOptions?: string[];
  /** Available state options */
  stateOptions?: string[];
  /** Available team options */
  teamOptions?: Array<{ id: string; name: string }>;
  /** Whether to show the panel */
  visible?: boolean;
  /** Callback when panel is closed */
  onClose?: () => void;
}

/**
 * Filter state interface
 */
export interface FilterState {
  /** Severity filters */
  severity?: string[];
  /** State filters */
  state?: string[];
  /** Team filters */
  teams?: string[];
  /** Search text */
  search?: string;
}

/**
 * Props for DNDControls component
 */
export interface DNDControlsProps {
  /** Whether DND is enabled */
  enabled: boolean;
  /** DND duration in minutes */
  durationMinutes?: number;
  /** Callback when DND state changes */
  onChange: (enabled: boolean, durationMinutes?: number) => void;
  /** Available duration presets */
  durationPresets?: number[];
}

/**
 * Props for ResolveIncidentModal component
 */
export interface ResolveIncidentModalProps {
  /** Incident to resolve */
  incident: Incident;
  /** Whether modal is visible */
  visible: boolean;
  /** Callback when modal is closed */
  onClose: () => void;
  /** Callback when incident is resolved */
  onResolve: (data: ResolutionData) => void;
}

/**
 * Resolution data submitted from modal
 */
export interface ResolutionData {
  /** Resolution status */
  state: 'resolved' | 'closed';
  /** Root cause description */
  rootCause?: string;
  /** Resolution summary */
  summary?: string;
  /** Custom metadata */
  metadata?: Record<string, any>;
}

/**
 * Props for AIDiagnosisPanel component
 */
export interface AIDiagnosisPanelProps {
  /** Incident to analyze */
  incident: Incident;
  /** Whether panel is loading */
  isLoading?: boolean;
  /** Error message if analysis failed */
  error?: string;
  /** AI diagnosis result */
  diagnosis?: string;
  /** Callback to run analysis */
  onAnalyze?: () => void;
  /** Callback when panel is closed */
  onClose?: () => void;
}

/**
 * Props for AIAssistantPanel component
 */
export interface AIAssistantPanelProps {
  /** Incident context for the assistant */
  incident?: Incident;
  /** Chat messages history */
  messages?: Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
  }>;
  /** Whether the assistant is responding */
  isLoading?: boolean;
  /** Callback when user sends a message */
  onSendMessage?: (message: string) => void;
  /** Callback when panel is closed */
  onClose?: () => void;
}

/**
 * Props for ServiceHealthBadge component
 */
export interface ServiceHealthBadgeProps {
  /** Service name */
  name: string;
  /** Health status: healthy, warning, critical */
  status: 'healthy' | 'warning' | 'critical';
  /** Current incident count */
  incidentCount?: number;
  /** Callback when badge is pressed */
  onPress?: () => void;
  /** Custom styling */
  style?: Record<string, any>;
}

/**
 * Props for SimilarIncidentHint component
 */
export interface SimilarIncidentHintProps {
  /** Related incident */
  incident: Incident;
  /** Callback when hint is pressed */
  onPress: (incident: Incident) => void;
  /** Custom styling */
  style?: Record<string, any>;
}

/**
 * Props for OnCallBanner component
 */
export interface OnCallBannerProps {
  /** Current on-call person name */
  oncallPersonName?: string;
  /** Current on-call person email */
  oncallPersonEmail?: string;
  /** Current on-call person avatar URL */
  oncallPersonAvatarUrl?: string;
  /** Callback when banner is pressed */
  onPress?: () => void;
  /** Custom styling */
  style?: Record<string, any>;
}

/**
 * Props for GlobalSearch component
 */
export interface GlobalSearchProps {
  /** Whether search is visible */
  visible?: boolean;
  /** Search query */
  query?: string;
  /** Callback when search query changes */
  onQueryChange?: (query: string) => void;
  /** Search results */
  results?: Array<{
    id: string;
    title: string;
    type: 'incident' | 'service' | 'team' | 'schedule';
    onPress: () => void;
  }>;
  /** Callback when search is closed */
  onClose?: () => void;
}

/**
 * Props for StickyActionBar component
 */
export interface StickyActionBarProps {
  /** Action buttons configuration */
  actions: Array<{
    label: string;
    icon?: React.ReactNode;
    onPress: () => void;
    disabled?: boolean;
    variant?: 'primary' | 'secondary' | 'destructive';
  }>;
  /** Whether the bar is visible */
  visible?: boolean;
  /** Whether to show as fixed at bottom */
  sticky?: boolean;
  /** Custom styling */
  style?: Record<string, any>;
}

/**
 * Props for OfflineBanner component
 */
export interface OfflineBannerProps {
  /** Whether the device is offline */
  isOffline?: boolean;
  /** Custom styling */
  style?: Record<string, any>;
}

/**
 * Props for ProfilePictureEditor component
 */
export interface ProfilePictureEditorProps {
  /** Current profile picture URL */
  currentImageUrl?: string;
  /** Callback when image is selected */
  onImageSelected: (imageUri: string) => void;
  /** Callback when editor is closed */
  onClose?: () => void;
}

/**
 * Props for ShiftHandoffNotes component
 */
export interface ShiftHandoffNotesProps {
  /** Notes content */
  notes?: string;
  /** Whether notes are being edited */
  isEditing?: boolean;
  /** Callback when notes are saved */
  onSave?: (notes: string) => void;
  /** Callback to start editing */
  onEditStart?: () => void;
}

/**
 * Props for KeyboardShortcutsHelp component
 */
export interface KeyboardShortcutsHelpProps {
  /** Whether the help dialog is visible */
  visible?: boolean;
  /** Callback to close the help */
  onClose?: () => void;
}

/**
 * Props for RelatedIncidents component
 */
export interface RelatedIncidentsProps {
  /** The current incident */
  currentIncident: Incident;
  /** Related incidents */
  incidents: Incident[];
  /** Callback when an incident is selected */
  onSelectIncident: (incident: Incident) => void;
  /** Custom styling */
  style?: Record<string, any>;
}

/**
 * Props for FilterChip component
 */
export interface FilterChipProps {
  /** Chip label */
  label: string;
  /** Whether chip is selected */
  selected?: boolean;
  /** Callback when chip is pressed */
  onPress?: () => void;
  /** Custom styling */
  style?: Record<string, any>;
}

/**
 * Props for ResolveTemplatesModal component
 */
export interface ResolveTemplatesModalProps {
  /** Whether modal is visible */
  visible: boolean;
  /** Callback when modal is closed */
  onClose: () => void;
  /** Callback when template is selected */
  onSelectTemplate: (template: ResolutionTemplate) => void;
}

/**
 * Resolution template interface
 */
export interface ResolutionTemplate {
  /** Template ID */
  id: string;
  /** Template name */
  name: string;
  /** Template description */
  description?: string;
  /** Root cause suggestion */
  rootCause?: string;
  /** Resolution summary template */
  summary?: string;
}

/**
 * Props for ConfettiOverlay component
 */
export interface ConfettiOverlayProps {
  /** Whether confetti should be shown */
  visible?: boolean;
  /** Duration of animation (ms) */
  duration?: number;
  /** Callback when animation completes */
  onComplete?: () => void;
}
