-- Seed test data for PagerDuty-Lite MVP
-- Run this after migrating the database schema
-- This creates a test organization, links the Cognito user, creates a service, and adds sample incidents

-- Insert test organization
INSERT INTO organizations (id, name, status, plan, settings)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'Test Organization',
  'active',
  'free',
  '{"features": ["alerts", "push_notifications"]}'::jsonb
) ON CONFLICT DO NOTHING;

-- Insert test user (linked to Cognito user test@example.com)
-- Replace the cognito_sub with the actual sub from the Cognito user
INSERT INTO users (id, org_id, email, cognito_sub, full_name, role, status, phone_number)
VALUES (
  '22222222-2222-2222-2222-222222222222',
  '11111111-1111-1111-1111-111111111111',
  'test@example.com',
  '344894f8-b061-7040-0a36-7d75819f1b12', -- Cognito sub for test@example.com
  'Test User',
  'admin',
  'active',
  '+1234567890'
) ON CONFLICT (email) DO NOTHING;

-- Insert test schedule
INSERT INTO schedules (id, org_id, name, description, type, timezone, current_oncall_user_id)
VALUES (
  '33333333-3333-3333-3333-333333333333',
  '11111111-1111-1111-1111-111111111111',
  'Primary On-Call',
  'Main on-call schedule for test organization',
  'manual',
  'America/New_York',
  '22222222-2222-2222-2222-222222222222'
) ON CONFLICT DO NOTHING;

-- Insert test escalation policy
INSERT INTO escalation_policies (id, org_id, name, description)
VALUES (
  '88888888-8888-8888-8888-888888888888',
  '11111111-1111-1111-1111-111111111111',
  'Default Escalation',
  'Standard escalation policy for production services'
) ON CONFLICT DO NOTHING;

-- Insert escalation step (Level 1: Primary On-Call Schedule)
INSERT INTO escalation_steps (
  escalation_policy_id,
  step_order,
  target_type,
  schedule_id,
  timeout_seconds
)
VALUES (
  '88888888-8888-8888-8888-888888888888',
  1,
  'schedule',
  '33333333-3333-3333-3333-333333333333',
  300
) ON CONFLICT DO NOTHING;

-- Insert test service
INSERT INTO services (id, org_id, name, description, api_key, email_address, escalation_policy_id, status)
VALUES (
  '44444444-4444-4444-4444-444444444444',
  '11111111-1111-1111-1111-111111111111',
  'Production API',
  'Main production API service',
  'test-api-key-12345',
  'alerts-prod-api@example.com',
  '88888888-8888-8888-8888-888888888888',
  'active'
) ON CONFLICT DO NOTHING;

-- Insert another test service
INSERT INTO services (id, org_id, name, description, api_key, email_address, escalation_policy_id, status)
VALUES (
  '55555555-5555-5555-5555-555555555555',
  '11111111-1111-1111-1111-111111111111',
  'Web Server',
  'Frontend web server service',
  'test-api-key-67890',
  'alerts-web-server@example.com',
  '88888888-8888-8888-8888-888888888888',
  'active'
) ON CONFLICT DO NOTHING;

-- Insert test incidents (alerts)
INSERT INTO incidents (
  id, org_id, service_id, incident_number, dedup_key, summary, details,
  severity, state, triggered_at, event_count
)
VALUES
  (
    '66666666-6666-6666-6666-666666666666',
    '11111111-1111-1111-1111-111111111111',
    '44444444-4444-4444-4444-444444444444',
    1,
    'db-connection-timeout-prod',
    'Database connection timeout',
    '{"error": "Connection timeout after 30s", "host": "db-primary.internal", "query": "SELECT * FROM users WHERE id = ?"}'::jsonb,
    'critical',
    'triggered',
    NOW() - INTERVAL '2 minutes',
    1
  ),
  (
    '77777777-7777-7777-7777-777777777777',
    '11111111-1111-1111-1111-111111111111',
    '55555555-5555-5555-5555-555555555555',
    2,
    'high-cpu-usage-web-01',
    'High CPU usage detected',
    '{"cpu_percent": 92, "threshold": 80, "duration": "5m", "server": "web-01"}'::jsonb,
    'warning',
    'triggered',
    NOW() - INTERVAL '15 minutes',
    3
  ),
  (
    '88888888-8888-8888-8888-888888888888',
    '11111111-1111-1111-1111-111111111111',
    '44444444-4444-4444-4444-444444444444',
    3,
    'ssl-cert-expiring',
    'SSL certificate expiring soon',
    '{"domain": "api.example.com", "expires_in": "7 days", "issuer": "LetsEncrypt"}'::jsonb,
    'warning',
    'acknowledged',
    NOW() - INTERVAL '1 hour',
    1
  ),
  (
    '99999999-9999-9999-9999-999999999999',
    '11111111-1111-1111-1111-111111111111',
    '55555555-5555-5555-5555-555555555555',
    4,
    'disk-space-low-web-02',
    'Disk space low',
    '{"disk": "/dev/sda1", "used_percent": 85, "threshold": 80, "available": "15GB"}'::jsonb,
    'info',
    'triggered',
    NOW() - INTERVAL '3 hours',
    2
  ),
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '11111111-1111-1111-1111-111111111111',
    '44444444-4444-4444-4444-444444444444',
    5,
    'api-rate-limit-exceeded',
    'API rate limit exceeded',
    '{"endpoint": "/api/v1/users", "rate_limit": 1000, "current_rate": 1523, "client_ip": "192.168.1.100"}'::jsonb,
    'critical',
    'resolved',
    NOW() - INTERVAL '5 hours',
    5
  )
ON CONFLICT DO NOTHING;

-- Update acknowledged incident
UPDATE incidents
SET
  acknowledged_at = NOW() - INTERVAL '45 minutes',
  acknowledged_by = '22222222-2222-2222-2222-222222222222'
WHERE id = '88888888-8888-8888-8888-888888888888';

-- Update resolved incident
UPDATE incidents
SET
  acknowledged_at = NOW() - INTERVAL '4 hours 30 minutes',
  acknowledged_by = '22222222-2222-2222-2222-222222222222',
  resolved_at = NOW() - INTERVAL '4 hours',
  resolved_by = '22222222-2222-2222-2222-222222222222'
WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

-- Insert incident events for the resolved alert
INSERT INTO incident_events (incident_id, type, actor_id, message)
VALUES
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'acknowledge',
    '22222222-2222-2222-2222-222222222222',
    'Acknowledged by Test User'
  ),
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'note',
    '22222222-2222-2222-2222-222222222222',
    'Rate limit was temporarily increased to handle traffic spike'
  ),
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'resolve',
    '22222222-2222-2222-2222-222222222222',
    'Resolved by Test User - Traffic normalized'
  );
