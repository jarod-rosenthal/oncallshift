const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const connectionString = 'postgres://pgadmin:-%3ES1YS%3CFM%5BlZ1%5D8%28%28BIfWK1kahm%3Cn6o1@pagerduty-lite-dev.cn9wuodq8uyb.us-east-1.rds.amazonaws.com:5432/pagerduty_lite?sslmode=require';

async function createDemoUsers() {
  const client = new Client({ connectionString });

  try {
    await client.connect();
    console.log('Connected to database');

    // Read the SQL file
    const sql = fs.readFileSync(path.join(__dirname, 'create-demo-users.sql'), 'utf8');

    // Execute the SQL
    await client.query(sql);
    console.log('✅ Demo users created successfully!');

    // Verify they exist
    const result = await client.query(`
      SELECT id, email, full_name, role,
             (settings->'availability' IS NOT NULL) as has_availability
      FROM users
      WHERE email IN ('alice.jones@example.com', 'bob.smith@example.com')
      ORDER BY email
    `);

    console.log('\nCreated users:');
    result.rows.forEach(user => {
      console.log(`  - ${user.full_name} (${user.email})`);
      console.log(`    ID: ${user.id}`);
      console.log(`    Role: ${user.role}`);
      console.log(`    Has Availability: ${user.has_availability}`);
    });

  } catch (error) {
    console.error('❌ Failed to create demo users:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

createDemoUsers();
