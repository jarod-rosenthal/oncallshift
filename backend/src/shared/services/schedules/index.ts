/**
 * Schedules Services Barrel Exports
 * Central export point for all schedule-related services
 */

export { OverrideValidationService } from './override-validation.service';
export { OverrideFormatterService } from './override-formatter.service';
export { OnCallCalculationService } from './oncall-calculation.service';
export { LayerCalculationService } from './layer-calculation.service';

// Re-export types for convenience
export type {
  CreateOverrideRequest,
  UpdateOverrideRequest,
  OverrideStatus,
  OverrideUserInfo,
  OverrideResponse,
  ListOverridesResponse,
  CreateOverrideResponse,
  UpdateOverrideResponse,
  OverlapDetectionResult,
  OverrideValidationResult,
} from '../../../api/routes/types/schedule-override.types';

export type {
  OnCallCalculationResult,
  LayerCalculationResult,
  RotationType,
  LayerRestrictions,
  RotationIndexResult,
  HandoffResult,
  LegacyRotationConfig,
} from '../../../api/routes/types/schedule-calculation.types';
