const { Client } = require('pg');

async function updateOncall() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    
    const result = await client.query(`
      UPDATE schedules
      SET current_oncall_user_id = (
        SELECT id FROM users
        WHERE email = 'jarod.rosenthal@protonmail.com'
        LIMIT 1
      )
      WHERE id = '33333333-3333-3333-3333-333333333333'
      RETURNING id, name, current_oncall_user_id
    `);
    
    console.log('✅ Schedule updated!', result.rows[0]);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

updateOncall();
