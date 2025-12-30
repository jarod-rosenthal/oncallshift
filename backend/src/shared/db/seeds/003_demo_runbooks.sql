-- Demo runbooks with actionable steps
-- Run this after test data is seeded

-- Production API: Database Fix
INSERT INTO runbooks (
  id, org_id, service_id, title, description, steps, severity, tags, external_url, created_by, is_active
)
VALUES (
  'a1111111-1111-1111-1111-111111111111',
  '11111111-1111-1111-1111-111111111111',
  '44444444-4444-4444-4444-444444444444',
  'Database Connection Fix',
  'One-click database recovery actions',
  '[
    {
      "id": "step-db-1",
      "order": 1,
      "title": "Restart Connection Pool",
      "description": "Restarts API pods to reset stale database connections",
      "isOptional": false,
      "estimatedMinutes": 2,
      "action": {
        "type": "webhook",
        "label": "Restart Pods",
        "url": "/api/v1/actions/restart-pods",
        "method": "POST",
        "body": {"deployment": "api", "namespace": "production"},
        "confirmMessage": "This will restart all API pods. Continue?"
      }
    },
    {
      "id": "step-db-2",
      "order": 2,
      "title": "Scale Up Replicas",
      "description": "Adds more API instances to handle connection load",
      "isOptional": true,
      "estimatedMinutes": 1,
      "action": {
        "type": "webhook",
        "label": "Scale to 5",
        "url": "/api/v1/actions/scale-deployment",
        "method": "POST",
        "body": {"deployment": "api", "replicas": 5}
      }
    },
    {
      "id": "step-db-3",
      "order": 3,
      "title": "Flush Connection Cache",
      "description": "Clears the PgBouncer connection cache",
      "isOptional": true,
      "estimatedMinutes": 1,
      "action": {
        "type": "webhook",
        "label": "Flush Cache",
        "url": "/api/v1/actions/flush-pgbouncer",
        "method": "POST"
      }
    }
  ]'::jsonb,
  ARRAY['critical', 'error']::varchar[],
  ARRAY['database', 'connectivity']::varchar[],
  NULL,
  '22222222-2222-2222-2222-222222222222',
  true
) ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  steps = EXCLUDED.steps,
  severity = EXCLUDED.severity,
  tags = EXCLUDED.tags;

-- Production API: High Error Rate Fix
INSERT INTO runbooks (
  id, org_id, service_id, title, description, steps, severity, tags, external_url, created_by, is_active
)
VALUES (
  'a2222222-2222-2222-2222-222222222222',
  '11111111-1111-1111-1111-111111111111',
  '44444444-4444-4444-4444-444444444444',
  'API Error Spike Fix',
  'Quick remediation for elevated error rates',
  '[
    {
      "id": "step-err-1",
      "order": 1,
      "title": "Rollback Deployment",
      "description": "Reverts to the previous stable version",
      "isOptional": false,
      "estimatedMinutes": 2,
      "action": {
        "type": "webhook",
        "label": "Rollback Now",
        "url": "/api/v1/actions/rollback",
        "method": "POST",
        "body": {"deployment": "api"},
        "confirmMessage": "This will rollback to the previous deployment. Continue?"
      }
    },
    {
      "id": "step-err-2",
      "order": 2,
      "title": "Enable Rate Limiting",
      "description": "Activates request throttling to protect the service",
      "isOptional": true,
      "estimatedMinutes": 1,
      "action": {
        "type": "webhook",
        "label": "Enable Limits",
        "url": "/api/v1/actions/rate-limit",
        "method": "POST",
        "body": {"enabled": true, "rps": 100}
      }
    },
    {
      "id": "step-err-3",
      "order": 3,
      "title": "Clear Error Cache",
      "description": "Flushes cached error responses",
      "isOptional": true,
      "estimatedMinutes": 1,
      "action": {
        "type": "webhook",
        "label": "Clear Cache",
        "url": "/api/v1/actions/clear-cache",
        "method": "POST"
      }
    }
  ]'::jsonb,
  ARRAY['error']::varchar[],
  ARRAY['api', 'errors', 'deployment']::varchar[],
  NULL,
  '22222222-2222-2222-2222-222222222222',
  true
) ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  steps = EXCLUDED.steps,
  severity = EXCLUDED.severity,
  tags = EXCLUDED.tags;

-- Web Server: High CPU Fix
INSERT INTO runbooks (
  id, org_id, service_id, title, description, steps, severity, tags, external_url, created_by, is_active
)
VALUES (
  'a3333333-3333-3333-3333-333333333333',
  '11111111-1111-1111-1111-111111111111',
  '55555555-5555-5555-5555-555555555555',
  'High CPU Fix',
  'Auto-scaling and traffic management',
  '[
    {
      "id": "step-cpu-1",
      "order": 1,
      "title": "Scale Out",
      "description": "Adds more instances to distribute CPU load",
      "isOptional": false,
      "estimatedMinutes": 2,
      "action": {
        "type": "webhook",
        "label": "Add 3 Instances",
        "url": "/api/v1/actions/scale-deployment",
        "method": "POST",
        "body": {"deployment": "web", "replicas": 5}
      }
    },
    {
      "id": "step-cpu-2",
      "order": 2,
      "title": "Enable Traffic Shedding",
      "description": "Drops low-priority requests to reduce load",
      "isOptional": true,
      "estimatedMinutes": 1,
      "action": {
        "type": "webhook",
        "label": "Shed Traffic",
        "url": "/api/v1/actions/traffic-shed",
        "method": "POST",
        "body": {"percentage": 20}
      }
    },
    {
      "id": "step-cpu-3",
      "order": 3,
      "title": "Kill Long Queries",
      "description": "Terminates database queries running over 30s",
      "isOptional": true,
      "estimatedMinutes": 1,
      "action": {
        "type": "webhook",
        "label": "Kill Queries",
        "url": "/api/v1/actions/kill-queries",
        "method": "POST",
        "body": {"threshold_seconds": 30}
      }
    }
  ]'::jsonb,
  ARRAY['warning', 'error']::varchar[],
  ARRAY['cpu', 'scaling']::varchar[],
  NULL,
  '22222222-2222-2222-2222-222222222222',
  true
) ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  steps = EXCLUDED.steps,
  severity = EXCLUDED.severity,
  tags = EXCLUDED.tags;

-- Web Server: Disk Space Fix
INSERT INTO runbooks (
  id, org_id, service_id, title, description, steps, severity, tags, external_url, created_by, is_active
)
VALUES (
  'a4444444-4444-4444-4444-444444444444',
  '11111111-1111-1111-1111-111111111111',
  '55555555-5555-5555-5555-555555555555',
  'Disk Cleanup',
  'Automated disk space recovery',
  '[
    {
      "id": "step-disk-1",
      "order": 1,
      "title": "Rotate Logs",
      "description": "Compresses and archives old log files",
      "isOptional": false,
      "estimatedMinutes": 1,
      "action": {
        "type": "webhook",
        "label": "Rotate Now",
        "url": "/api/v1/actions/rotate-logs",
        "method": "POST"
      }
    },
    {
      "id": "step-disk-2",
      "order": 2,
      "title": "Clear Temp Files",
      "description": "Removes temporary files older than 24 hours",
      "isOptional": false,
      "estimatedMinutes": 1,
      "action": {
        "type": "webhook",
        "label": "Clear Temp",
        "url": "/api/v1/actions/clear-temp",
        "method": "POST",
        "body": {"older_than_hours": 24}
      }
    },
    {
      "id": "step-disk-3",
      "order": 3,
      "title": "Prune Docker",
      "description": "Removes unused Docker images and containers",
      "isOptional": true,
      "estimatedMinutes": 2,
      "action": {
        "type": "webhook",
        "label": "Prune Docker",
        "url": "/api/v1/actions/docker-prune",
        "method": "POST",
        "confirmMessage": "This will remove all unused Docker resources. Continue?"
      }
    }
  ]'::jsonb,
  ARRAY['info', 'warning']::varchar[],
  ARRAY['disk', 'cleanup']::varchar[],
  NULL,
  '22222222-2222-2222-2222-222222222222',
  true
) ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  steps = EXCLUDED.steps,
  severity = EXCLUDED.severity,
  tags = EXCLUDED.tags;
