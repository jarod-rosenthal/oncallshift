const { Client } = require('pg');

const connectionString = 'postgres://pgadmin:-%3ES1YS%3CFM%5BlZ1%5D8%28%28BIfWK1kahm%3Cn6o1@pagerduty-lite-dev.cn9wuodq8uyb.us-east-1.rds.amazonaws.com:5432/pagerduty_lite?sslmode=require';

const migrationSQL = `
-- Add schedule_members table for managing on-call rotation membership

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

-- Update trigger
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_schedule_members_updated_at') THEN
        CREATE TRIGGER update_schedule_members_updated_at BEFORE UPDATE ON schedule_members
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END$$;

COMMENT ON TABLE schedule_members IS 'Users assigned to on-call schedules with rotation order';
`;

async function runMigration() {
  const client = new Client({ connectionString });

  try {
    await client.connect();
    console.log('Connected to database');

    await client.query(migrationSQL);
    console.log('✅ Migration completed successfully!');

    // Verify table exists
    const result = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = 'schedule_members'
    `);

    if (result.rows.length > 0) {
      console.log('✅ schedule_members table created successfully');
    }

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
