const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigrations() {
  const client = new Client({
    host: 'pagerduty-lite-dev.cn9wuodq8uyb.us-east-1.rds.amazonaws.com',
    port: 5432,
    user: 'pgadmin',
    password: '->S1YS<FM[lZ1]8((BIfWK1kahm<n6o1',
    database: 'pagerduty_lite',
    ssl: { rejectUnauthorized: false }
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
    checkTables.rows.forEach(row => console.log(`  - ${row.table_name}`));

    if (checkTables.rows.length === 0) {
      console.log('\n📋 Running migration...');
      const migrationSQL = fs.readFileSync(
        path.join(__dirname, 'src/shared/db/migrations/001_initial_schema.sql'),
        'utf8'
      );
      await client.query(migrationSQL);
      console.log('✅ Migration completed successfully!');
    } else {
      console.log('\n⚠️  Tables already exist, skipping migration');
    }

    // Run seed data
    console.log('\n🌱 Running seed data...');
    const seedSQL = fs.readFileSync(
      path.join(__dirname, 'src/shared/db/seeds/001_test_data.sql'),
      'utf8'
    );
    await client.query(seedSQL);
    console.log('✅ Seed data inserted successfully!');

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
    throw error;
  } finally {
    await client.end();
    console.log('\nDatabase connection closed');
  }
}

runMigrations()
  .then(() => {
    console.log('\n✨ All done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Failed:', error);
    process.exit(1);
  });
