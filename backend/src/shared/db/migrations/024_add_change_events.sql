-- Migration: Add change_events table for PagerDuty change event tracking
-- Change events are informational records (no alerts/escalations)

CREATE TABLE IF NOT EXISTS change_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  summary VARCHAR(1024) NOT NULL,
  source VARCHAR(255),
  timestamp TIMESTAMPTZ,
  custom_details JSONB,
  links JSONB,
  routing_key VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for querying change events by service
CREATE INDEX IF NOT EXISTS idx_change_events_service_id ON change_events(service_id);

-- Index for querying recent change events
CREATE INDEX IF NOT EXISTS idx_change_events_created_at ON change_events(created_at DESC);

-- Composite index for service + time range queries
CREATE INDEX IF NOT EXISTS idx_change_events_service_time ON change_events(service_id, created_at DESC);
