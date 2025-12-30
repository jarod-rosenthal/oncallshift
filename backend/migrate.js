#!/usr/bin/env node
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Parse DATABASE_URL
const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('DATABASE_URL environment variable is required');
  process.exit(1);
}

const url = new URL(dbUrl.replace('postgres://', 'postgresql://'));

async function runMigrations() {
  const client = new Client({
    host: url.hostname,
    port: url.port || 5432,
    user: url.username,
    password: decodeURIComponent(url.password),
    database: url.pathname.slice(1),
    ssl: url.searchParams.get('sslmode') ? { rejectUnauthorized: false } : false
  });

  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('Connected successfully!');

    // Check if tables exist
    const checkTables = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
    `);

    console.log(`\nExisting tables: ${checkTables.rows.length}`);

    if (checkTables.rows.length === 0) {
      console.log('\n📋 Running initial migration...');
      const migrationSQL = fs.readFileSync(
        path.join(__dirname, 'dist/../src/shared/db/migrations/001_initial_schema.sql'),
        'utf8'
      );
      await client.query(migrationSQL);
      console.log('✅ Initial migration completed successfully!');
    } else {
      console.log('⚠️  Tables already exist, running incremental migrations...');
    }

    // Run incremental migrations
    const migrations = [
      '002_add_schedule_members.sql',
      '003_add_escalation_policies.sql',
      '004_add_incident_actions.sql',
      '005_add_performance_indexes.sql',
      '006_add_user_anthropic_credentials.sql',
      '007_add_runbooks.sql',
    ];

    for (const migration of migrations) {
      const migrationPath = path.join(__dirname, 'dist/../src/shared/db/migrations', migration);
      if (fs.existsSync(migrationPath)) {
        console.log(`\n📋 Running migration: ${migration}...`);
        try {
          const sql = fs.readFileSync(migrationPath, 'utf8');
          await client.query(sql);
          console.log(`✅ ${migration} completed successfully!`);
        } catch (error) {
          // Ignore errors from "already exists" - these are expected for incremental migrations
          if (error.message.includes('already exists') || error.message.includes('duplicate')) {
            console.log(`⏭️  ${migration} already applied, skipping...`);
          } else {
            throw error;
          }
        }
      }
    }

    // Run seed data
    console.log('\n🌱 Running seed data...');
    const seedSQL = fs.readFileSync(
      path.join(__dirname, 'dist/../src/shared/db/seeds/001_test_data.sql'),
      'utf8'
    );
    await client.query(seedSQL);
    console.log('✅ Seed data 001 inserted successfully!');

    // Run additional seed file for Jarod
    console.log('\n🌱 Running additional seed data (002_add_jarod)...');
    const seedSQL2 = fs.readFileSync(
      path.join(__dirname, 'dist/../src/shared/db/seeds/002_add_jarod.sql'),
      'utf8'
    );
    await client.query(seedSQL2);
    console.log('✅ Seed data 002 inserted successfully!');

    // Run demo runbooks seed
    console.log('\n🌱 Running demo runbooks seed (003_demo_runbooks)...');
    const seedSQL3 = fs.readFileSync(
      path.join(__dirname, 'dist/../src/shared/db/seeds/003_demo_runbooks.sql'),
      'utf8'
    );
    await client.query(seedSQL3);
    console.log('✅ Demo runbooks seed data inserted successfully!');

    // Verify data
    console.log('\n📊 Verifying data...');
    const counts = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM organizations) as orgs,
        (SELECT COUNT(*) FROM users) as users,
        (SELECT COUNT(*) FROM services) as services,
        (SELECT COUNT(*) FROM incidents) as incidents
    `);
    console.log('Data counts:', counts.rows[0]);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\nDatabase connection closed');
  }
}

runMigrations()
  .then(() => {
    console.log('\n✨ Migration completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  });
