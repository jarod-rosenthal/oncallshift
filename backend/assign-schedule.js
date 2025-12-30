// Quick script to assign schedule to service
const { Pool } = require('pg');

async function assignSchedule() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    // Update service
    await pool.query(`
      UPDATE services 
      SET schedule_id = '33333333-3333-3333-3333-333333333333'
      WHERE id = '44444444-4444-4444-4444-444444444444'
    `);
    
    // Set on-call user
    await pool.query(`
      UPDATE schedules
      SET current_oncall_user_id = (
        SELECT id FROM users 
        WHERE email = 'jarod.rosenthal@protonmail.com' 
        LIMIT 1
      )
      WHERE id = '33333333-3333-3333-3333-333333333333'
    `);
    
    // Verify
    const result = await pool.query(`
      SELECT 
        s.name as service_name,
        sch.name as schedule_name,
        u.email as oncall_user_email
      FROM services s
      LEFT JOIN schedules sch ON s.schedule_id = sch.id
      LEFT JOIN users u ON sch.current_oncall_user_id = u.id
      WHERE s.id = '44444444-4444-4444-4444-444444444444'
    `);
    
    console.log('✅ Schedule assigned successfully!');
    console.log(result.rows[0]);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

assignSchedule();
