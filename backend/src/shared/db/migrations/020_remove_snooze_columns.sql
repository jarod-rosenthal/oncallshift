-- Migration: Remove snooze functionality from incidents
-- The snooze feature has been removed from the application.
-- This migration drops the snoozed_until and snoozed_by columns.

-- Drop the snooze index first
DROP INDEX IF EXISTS idx_incidents_snoozed;

-- Drop the snooze columns
ALTER TABLE incidents DROP COLUMN IF EXISTS snoozed_until;
ALTER TABLE incidents DROP COLUMN IF EXISTS snoozed_by;
