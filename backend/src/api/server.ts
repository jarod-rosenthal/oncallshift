import 'dotenv/config';
import { initSentry } from '../shared/config/sentry';

// Initialize Sentry BEFORE other imports (catches early errors)
initSentry();

import { createApp } from './app';
import { getDataSource } from '../shared/db/data-source';
import { logger } from '../shared/utils/logger';
import { seedOnCallShiftRunbooks } from '../shared/db/seeds/oncallshift-runbooks';

const PORT = process.env.PORT || 3000;

async function runMigrations() {
  try {
    const dataSource = await getDataSource();

    // Check if schedule_members table exists
    const result = await dataSource.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = 'schedule_members'
    `);

    if (result.length === 0) {
      logger.info('Running schedule_members migration...');

      const migrationSQL = `
        CREATE TABLE IF NOT EXISTS schedule_members (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          schedule_id UUID NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          position INTEGER NOT NULL,
          added_by UUID REFERENCES users(id) ON DELETE SET NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT unique_schedule_user UNIQUE (schedule_id, user_id),
          CONSTRAINT unique_schedule_position UNIQUE (schedule_id, position)
        );

        CREATE INDEX IF NOT EXISTS idx_schedule_members_schedule_id ON schedule_members(schedule_id);
        CREATE INDEX IF NOT EXISTS idx_schedule_members_user_id ON schedule_members(user_id);
        CREATE INDEX IF NOT EXISTS idx_schedule_members_position ON schedule_members(schedule_id, position);

        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_schedule_members_updated_at') THEN
            CREATE TRIGGER update_schedule_members_updated_at BEFORE UPDATE ON schedule_members
              FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
          END IF;
        END$$;

        COMMENT ON TABLE schedule_members IS 'Users assigned to on-call schedules with rotation order';
      `;

      await dataSource.query(migrationSQL);
      logger.info('✅ schedule_members migration completed successfully');
    } else {
      logger.info('schedule_members table already exists, skipping migration');
    }

    // Check if escalation_policies table exists
    const escalationResult = await dataSource.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = 'escalation_policies'
    `);

    if (escalationResult.length === 0) {
      logger.info('Running escalation_policies migration...');

      const escalationMigrationSQL = `
        CREATE TABLE IF NOT EXISTS escalation_policies (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS escalation_steps (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          escalation_policy_id UUID NOT NULL REFERENCES escalation_policies(id) ON DELETE CASCADE,
          step_order INTEGER NOT NULL,
          target_type VARCHAR(50) NOT NULL CHECK (target_type IN ('schedule', 'users')),
          schedule_id UUID REFERENCES schedules(id) ON DELETE SET NULL,
          user_ids JSONB,
          timeout_seconds INTEGER NOT NULL DEFAULT 300,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT check_target_consistency CHECK (
            (target_type = 'schedule' AND schedule_id IS NOT NULL AND user_ids IS NULL) OR
            (target_type = 'users' AND user_ids IS NOT NULL AND schedule_id IS NULL)
          ),
          CONSTRAINT unique_policy_step_order UNIQUE (escalation_policy_id, step_order)
        );

        ALTER TABLE services ADD COLUMN IF NOT EXISTS escalation_policy_id UUID REFERENCES escalation_policies(id) ON DELETE SET NULL;
        ALTER TABLE incidents ADD COLUMN IF NOT EXISTS current_escalation_step INTEGER DEFAULT 0;
        ALTER TABLE incidents ADD COLUMN IF NOT EXISTS escalation_started_at TIMESTAMP WITH TIME ZONE;

        CREATE INDEX IF NOT EXISTS idx_escalation_policies_org_id ON escalation_policies(org_id);
        CREATE INDEX IF NOT EXISTS idx_escalation_steps_policy_id ON escalation_steps(escalation_policy_id);
        CREATE INDEX IF NOT EXISTS idx_escalation_steps_schedule_id ON escalation_steps(schedule_id);
        CREATE INDEX IF NOT EXISTS idx_services_escalation_policy_id ON services(escalation_policy_id);
        CREATE INDEX IF NOT EXISTS idx_incidents_escalation ON incidents(current_escalation_step, escalation_started_at);

        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_escalation_policies_updated_at') THEN
            CREATE TRIGGER update_escalation_policies_updated_at BEFORE UPDATE ON escalation_policies
              FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_escalation_steps_updated_at') THEN
            CREATE TRIGGER update_escalation_steps_updated_at BEFORE UPDATE ON escalation_steps
              FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
          END IF;
        END$$;

        COMMENT ON TABLE escalation_policies IS 'Multi-level escalation policies for incident routing';
        COMMENT ON TABLE escalation_steps IS 'Individual steps within an escalation policy with timeout-based progression';
      `;

      await dataSource.query(escalationMigrationSQL);
      logger.info('✅ escalation_policies migration completed successfully');
    } else {
      logger.info('escalation_policies table already exists, skipping migration');
    }

    // Check if demo users exist
    const demoUsersCheck = await dataSource.query(`
      SELECT id, email, org_id FROM users WHERE email IN ('alice.jones@contoso.com', 'bob.smith@contoso.com')
    `);

    // Get the most common org_id (the one with the most users)
    const orgIdResult = await dataSource.query(`
      SELECT org_id, COUNT(*) as count
      FROM users
      WHERE email NOT IN ('alice.jones@contoso.com', 'bob.smith@contoso.com')
      GROUP BY org_id
      ORDER BY count DESC
      LIMIT 1
    `);

    const targetOrgId = orgIdResult[0]?.org_id;

    if (!targetOrgId) {
      logger.warn('No organization found, skipping demo users');
    } else {
      // One-time migration: Delete users with invalid UUIDs (old format)
      const invalidUUIDs = ['a1111111-1111-1111-1111-111111111111', 'b2222222-2222-2222-2222-222222222222'];
      const hasInvalidUUIDs = demoUsersCheck.some((u: any) => invalidUUIDs.includes(u.id));

      if (hasInvalidUUIDs) {
        logger.info('Migrating demo users from invalid UUIDs to valid UUID v4 format...');
        await dataSource.query(`
          DELETE FROM users
          WHERE id IN ('a1111111-1111-1111-1111-111111111111', 'b2222222-2222-2222-2222-222222222222')
        `);
      }

      // Create demo users if they don't exist (or were just deleted due to invalid UUIDs)
      const needsCreation = demoUsersCheck.length === 0 || hasInvalidUUIDs;

      if (needsCreation) {
        logger.info('Creating demo users Alice Jones and Bob Smith...');

      const demoUsersSQL = `
        DO $$
        DECLARE
          v_org_id UUID;
        BEGIN
          -- Get the org_id from existing users
          SELECT org_id INTO v_org_id FROM users LIMIT 1;

          -- Insert or update Alice Jones
          INSERT INTO users (
            id, org_id, email, cognito_sub, full_name, role, status, settings, created_at, updated_at
          ) VALUES (
            'a1111111-1111-4111-8111-111111111111',
            v_org_id,
            'alice.jones@contoso.com',
            '00000000-0000-0000-0000-000000000001',
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
          ) ON CONFLICT (id) DO UPDATE SET
            email = EXCLUDED.email,
            cognito_sub = EXCLUDED.cognito_sub,
            org_id = EXCLUDED.org_id,
            status = 'active';

          -- Insert or update Bob Smith
          INSERT INTO users (
            id, org_id, email, cognito_sub, full_name, role, status, settings, created_at, updated_at
          ) VALUES (
            'b2222222-2222-4222-8222-222222222222',
            v_org_id,
            'bob.smith@contoso.com',
            '00000000-0000-0000-0000-000000000002',
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
          ) ON CONFLICT (id) DO UPDATE SET
            email = EXCLUDED.email,
            cognito_sub = EXCLUDED.cognito_sub,
            org_id = EXCLUDED.org_id,
            status = 'active';

          RAISE NOTICE 'Demo users created successfully!';
        END $$;
      `;

      await dataSource.query(demoUsersSQL);
      logger.info('✅ Demo users Alice Jones and Bob Smith created successfully');
      } else {
        // Demo users exist with valid UUIDs, check if org_id needs updating
        const wrongOrgUsers = demoUsersCheck.filter((u: any) => u.org_id !== targetOrgId);
        if (wrongOrgUsers.length > 0) {
          logger.info('Updating demo users to correct org_id', { targetOrgId });
          await dataSource.query(`
            UPDATE users
            SET org_id = $1
            WHERE email IN ('alice.jones@contoso.com', 'bob.smith@contoso.com')
          `, [targetOrgId]);
          logger.info('✅ Demo users org_id updated successfully');
        } else {
          logger.info('Demo users already exist with correct UUIDs and org_id');
        }
      }
    }
  } catch (error) {
    logger.error('Migration failed:', error);
    // Don't exit - let the app start anyway
  }
}

async function startServer() {
  try {
    // Initialize database connection (optional for local dev)
    if (process.env.DATABASE_URL || process.env.DB_HOST) {
      logger.info('Connecting to database...');
      await getDataSource();
      logger.info('Database connected successfully');

      // Run migrations
      await runMigrations();

      // Seed OnCallShift example runbooks if they don't exist
      try {
        await seedOnCallShiftRunbooks();
        logger.info('✅ OnCallShift runbooks seeded successfully');
      } catch (error: any) {
        logger.warn('Could not seed OnCallShift runbooks:', error.message);
      }
    } else {
      logger.warn('No database configured - running without database connection');
      logger.warn('API endpoints that require database will fail');
      logger.warn('To enable database: set DATABASE_URL or DB_HOST environment variable');
    }

    // Create Express app
    const app = createApp();

    // Start listening
    app.listen(PORT, () => {
      logger.info(`🚀 API server started on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`Health check: http://localhost:${PORT}/health`);
      logger.info(`Frontend: http://localhost:${PORT}/`);
      logger.info(`Demo: http://localhost:${PORT}/demo`);
      logger.info(`API Docs: http://localhost:${PORT}/api-docs`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully...');
  process.exit(0);
});

// Start the server
startServer();
