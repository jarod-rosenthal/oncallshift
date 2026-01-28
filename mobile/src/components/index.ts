/**
 * Barrel exports for all mobile components
 *
 * This is the main export point for all components in the mobile application.
 * Components are organized by feature area for better organization.
 *
 * @example
 * // Import incident components
 * import { IncidentCard, EscalationBadge } from '@/components';
 *
 * // Import component types
 * import type { IncidentCardProps, FilterState } from '@/components';
 */

// ============================================================================
// Incident Display Components
// ============================================================================
export { IncidentCard } from './IncidentCard';
export { EscalationBadge } from './EscalationBadge';
export { default as UrgencyIndicator } from './UrgencyIndicator';
export { SimilarIncidentHint } from './SimilarIncidentHint';
export { default as RelatedIncidents } from './RelatedIncidents';
export { ServiceHealthBadge } from './ServiceHealthBadge';

// ============================================================================
// User/Team Display Components
// ============================================================================
export { OwnerAvatar } from './OwnerAvatar';
export { RespondersSection } from './RespondersSection';

// ============================================================================
// Action & Modal Components
// ============================================================================
export { default as ResolveIncidentModal, ROOT_CAUSE_OPTIONS } from './ResolveIncidentModal';
export { default as ResolveTemplatesModal, defaultResolveTemplates } from './ResolveTemplatesModal';
export { StickyActionBar } from './StickyActionBar';

// ============================================================================
// Filter & Control Components
// ============================================================================
export { FilterPanel, FilterChip, getFilterSummary, defaultFilters } from './FilterPanel';
export { DNDControls, useDNDStatus, shouldShowNotification, defaultDNDSettings } from './DNDControls';
export { GlobalSearch, SearchButton } from './GlobalSearch';
export { KeyboardShortcutsHelp } from './KeyboardShortcutsHelp';

// ============================================================================
// State & Notification Components
// ============================================================================
export { ToastProvider, useToast, toastMessages } from './ActionToast';
export { default as OfflineBanner, useOfflineStatus, useOfflineStatusFull } from './OfflineBanner';
export { default as EmptyState, EmptyStatePreset, getEmptyStateConfig } from './EmptyState';
export { ConfettiProvider, useConfetti } from './ConfettiOverlay';

// ============================================================================
// AI & Assistant Components
// ============================================================================
export { AIDiagnosisPanel } from './AIDiagnosisPanel';
export { default as AIAssistantPanel } from './AIAssistantPanel';

// ============================================================================
// User Settings & Info Components
// ============================================================================
export { OnCallBanner } from './OnCallBanner';
export { ShiftHandoffNotes } from './ShiftHandoffNotes';
export { ProfilePictureEditor } from './ProfilePictureEditor';

// ============================================================================
// Type Exports
// ============================================================================
export type {
  SizeVariant,
  IncidentCardProps,
  EscalationBadgeProps,
  UrgencyIndicatorProps,
  OwnerAvatarProps,
  RespondersSectionProps,
  EmptyStateProps,
  ActionToastProps,
  FilterPanelProps,
  FilterState,
  DNDControlsProps,
  ResolveIncidentModalProps,
  ResolutionData,
  AIDiagnosisPanelProps,
  AIAssistantPanelProps,
  ServiceHealthBadgeProps,
  SimilarIncidentHintProps,
  OnCallBannerProps,
  GlobalSearchProps,
  StickyActionBarProps,
  OfflineBannerProps,
  ProfilePictureEditorProps,
  ShiftHandoffNotesProps,
  KeyboardShortcutsHelpProps,
  RelatedIncidentsProps,
  FilterChipProps,
  ResolveTemplatesModalProps,
  ResolutionTemplate,
  ConfettiOverlayProps,
} from './types';
