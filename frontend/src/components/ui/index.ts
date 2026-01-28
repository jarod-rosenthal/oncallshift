/**
 * Barrel exports for base UI components
 *
 * This module provides a single import point for all base UI components.
 * These components form the foundation of the application's design system.
 *
 * @example
 * // Instead of:
 * import { Button } from '../ui/button';
 * import { Card } from '../ui/card';
 *
 * // You can do:
 * import { Button, Card } from '../ui';
 */

// Base components
export { Button } from './button';
export { Card } from './card';
export { Badge } from './badge';
export { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './dialog';
export { Input } from './input';
export { Label } from './label';
export { Select } from './select';
export { Switch } from './switch';

// Feature components
export { BulkActionBar } from './bulk-action-bar';
export { FilterChip } from './filter-chip';
export { StatusBadge } from './status-badge';
export { ThemeSwitcher } from './theme-switcher';
export { ScheduleTimeline } from './schedule-timeline';

// Form-related exports
export { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from './form';

// Type exports
export type { ButtonProps } from './button';
