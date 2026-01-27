/**
 * DEPRECATED: Color utilities have been moved to frontend/src/lib/colors.ts
 *
 * This file is kept for backwards compatibility. All new code should import
 * from '../lib/colors' instead.
 *
 * Migration guide:
 * - Replace: import { ... } from '../utils/colors'
 * - With:    import { ... } from '../lib/colors'
 */

// Re-export from the new location for backwards compatibility
export {
  getSeverityBadgeColor,
  getSeveritySolidColor,
  getStateBadgeColor,
  getEventColor,
  getEventIcon,
  getSeverityBorderColor,
  getSeverityLabel,
  getStateSolidColor,
  getStateLabel,
  getEventLabel,
  severityColorConfig,
  stateColorConfig,
  eventColorConfig,
  colorSystem,
} from '../lib/colors';
