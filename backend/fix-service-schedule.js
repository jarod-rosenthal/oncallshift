const { Client } = require('pg');

async function fixServiceSchedule() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  
  try {
    await client.connect();
    console.log('✅ Connected to database');
    
    // Check current state
    const check = await client.query(`
      SELECT s.id, s.name, s.schedule_id, sch.name as schedule_name
      FROM services s
      LEFT JOIN schedules sch ON s.schedule_id = sch.id
      WHERE s.id = '44444444-4444-4444-4444-444444444444'
    `);
    console.log('Before:', check.rows[0]);
    
    // Update service to assign schedule
    await client.query(`
      UPDATE services
      SET schedule_id = '33333333-3333-3333-3333-333333333333'
      WHERE id = '44444444-4444-4444-4444-444444444444'
    `);
    
    // Update schedule to set you as on-call
    await client.query(`
      UPDATE schedules
      SET current_oncall_user_id = (
        SELECT id FROM users WHERE email = 'jarod.rosenthal@protonmail.com' LIMIT 1
      )
      WHERE id = '33333333-3333-3333-3333-333333333333'
    `);
    
    // Verify
    const verify = await client.query(`
      SELECT s.name as service_name, sch.name as schedule_name, u.email as oncall_email
      FROM services s
      JOIN schedules sch ON s.schedule_id = sch.id
      LEFT JOIN users u ON sch.current_oncall_user_id = u.id
      WHERE s.id = '44444444-4444-4444-4444-444444444444'
    `);
    console.log('After:', verify.rows[0]);
    console.log('✅ Service-Schedule linkage fixed!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

fixServiceSchedule();
