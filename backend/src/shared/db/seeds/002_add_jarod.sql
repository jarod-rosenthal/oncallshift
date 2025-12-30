-- Add Jarod Rosenthal to the database
-- Run this to sync Cognito user with database

-- Ensure the organization exists
INSERT INTO organizations (id, name, status, plan, settings)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'Test Organization',
  'active',
  'free',
  '{"features": ["alerts", "push_notifications"]}'::jsonb
) ON CONFLICT (id) DO NOTHING;

-- Add Jarod's user
INSERT INTO users (org_id, email, cognito_sub, full_name, role, status)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'jarod.rosenthal@protonmail.com',
  '942874a8-0021-709f-16a1-3f4adac397f8',
  'Jarod Rosenthal',
  'admin',
  'active'
)
ON CONFLICT (email) DO UPDATE
  SET cognito_sub = EXCLUDED.cognito_sub,
      full_name = EXCLUDED.full_name,
      status = EXCLUDED.status,
      role = EXCLUDED.role;

-- Set Jarod as the current on-call user in the Primary schedule
UPDATE schedules
SET current_oncall_user_id = (
  SELECT id FROM users
  WHERE email = 'jarod.rosenthal@protonmail.com'
  LIMIT 1
)
WHERE id = '33333333-3333-3333-3333-333333333333'
  AND org_id = '11111111-1111-1111-1111-111111111111';

-- Ensure services use escalation policy (not direct schedule)
UPDATE services
SET escalation_policy_id = '88888888-8888-8888-8888-888888888888',
    schedule_id = NULL
WHERE org_id = '11111111-1111-1111-1111-111111111111'
  AND (id = '44444444-4444-4444-4444-444444444444' OR id = '55555555-5555-5555-5555-555555555555');
