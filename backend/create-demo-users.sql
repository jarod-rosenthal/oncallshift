-- Create demo users Alice Jones and Bob Smith

DO $$
DECLARE
  v_org_id UUID;
BEGIN
  -- Get the org_id from existing users
  SELECT org_id INTO v_org_id FROM users LIMIT 1;

  -- Insert Alice Jones
  INSERT INTO users (
    id,
    org_id,
    email,
    cognito_sub,
    full_name,
    role,
    status,
    settings,
    created_at,
    updated_at
  ) VALUES (
    'a1111111-1111-1111-1111-111111111111',
    v_org_id,
    'alice.jones@example.com',
    '2488d458-5051-7045-9240-bbe355b92629',
    'Alice Jones',
    'member',
    'active',
    jsonb_build_object(
      'availability', jsonb_build_object(
        'timezone', 'America/New_York',
        'weeklyHours', jsonb_build_object(
          'monday', jsonb_build_object('available', true, 'start', '00:00', 'end', '23:59'),
          'tuesday', jsonb_build_object('available', true, 'start', '00:00', 'end', '23:59'),
          'wednesday', jsonb_build_object('available', true, 'start', '00:00', 'end', '23:59'),
          'thursday', jsonb_build_object('available', true, 'start', '00:00', 'end', '23:59'),
          'friday', jsonb_build_object('available', true, 'start', '00:00', 'end', '23:59'),
          'saturday', jsonb_build_object('available', true, 'start', '00:00', 'end', '23:59'),
          'sunday', jsonb_build_object('available', true, 'start', '00:00', 'end', '23:59')
        ),
        'blackoutDates', '[]'::jsonb
      )
    ),
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ) ON CONFLICT (cognito_sub) DO NOTHING;

  -- Insert Bob Smith
  INSERT INTO users (
    id,
    org_id,
    email,
    cognito_sub,
    full_name,
    role,
    status,
    settings,
    created_at,
    updated_at
  ) VALUES (
    'b2222222-2222-2222-2222-222222222222',
    v_org_id,
    'bob.smith@example.com',
    'c4683438-1001-7056-1bad-3b67c33a443b',
    'Bob Smith',
    'member',
    'active',
    jsonb_build_object(
      'availability', jsonb_build_object(
        'timezone', 'America/New_York',
        'weeklyHours', jsonb_build_object(
          'monday', jsonb_build_object('available', true, 'start', '00:00', 'end', '23:59'),
          'tuesday', jsonb_build_object('available', true, 'start', '00:00', 'end', '23:59'),
          'wednesday', jsonb_build_object('available', true, 'start', '00:00', 'end', '23:59'),
          'thursday', jsonb_build_object('available', true, 'start', '00:00', 'end', '23:59'),
          'friday', jsonb_build_object('available', true, 'start', '00:00', 'end', '23:59'),
          'saturday', jsonb_build_object('available', true, 'start', '00:00', 'end', '23:59'),
          'sunday', jsonb_build_object('available', true, 'start', '00:00', 'end', '23:59')
        ),
        'blackoutDates', '[]'::jsonb
      )
    ),
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ) ON CONFLICT (cognito_sub) DO NOTHING;

  RAISE NOTICE 'Demo users created successfully!';
END $$;
