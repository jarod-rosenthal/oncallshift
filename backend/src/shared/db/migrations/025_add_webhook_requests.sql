-- Migration: Add webhook_requests table for async request tracking
-- Tracks status of webhook operations for Opsgenie-compatible request status API

CREATE TABLE IF NOT EXISTS webhook_requests (
  id UUID PRIMARY KEY,
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL,
  status VARCHAR(20) DEFAULT 'accepted',
  processed BOOLEAN DEFAULT FALSE,
  success BOOLEAN DEFAULT TRUE,
  message VARCHAR(500),
  alert_id VARCHAR(255),
  data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL
);

-- Index for looking up request by ID (primary lookup)
CREATE INDEX IF NOT EXISTS idx_webhook_requests_id ON webhook_requests(id);

-- Index for cleanup of expired requests
CREATE INDEX IF NOT EXISTS idx_webhook_requests_expires_at ON webhook_requests(expires_at);

-- Index for querying requests by service
CREATE INDEX IF NOT EXISTS idx_webhook_requests_service_id ON webhook_requests(service_id);

-- Composite index for service + time range queries
CREATE INDEX IF NOT EXISTS idx_webhook_requests_service_time ON webhook_requests(service_id, created_at DESC);
