const { Client } = require('pg');

async function addUser() {
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

    // Ensure organization exists
    console.log('\nEnsuring organization exists...');
    await client.query(`
      INSERT INTO organizations (id, name, status, plan, settings)
      VALUES (
        '11111111-1111-1111-1111-111111111111',
        'Test Organization',
        'active',
        'free',
        '{"features": ["alerts", "push_notifications"]}'::jsonb
      ) ON CONFLICT (id) DO NOTHING
    `);

    // Insert Jarod's user
    console.log('Adding user: jarod.rosenthal@protonmail.com...');
    const result = await client.query(`
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
            role = EXCLUDED.role
      RETURNING id, email, full_name, role, status
    `);

    console.log('\n✅ User added successfully!');
    console.log('User details:', result.rows[0]);

    // Verify user count
    const userCount = await client.query('SELECT COUNT(*) as count FROM users');
    console.log(`\nTotal users in database: ${userCount.rows[0].count}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await client.end();
    console.log('\nDatabase connection closed');
  }
}

addUser()
  .then(() => {
    console.log('\n✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Failed:', error);
    process.exit(1);
  });
