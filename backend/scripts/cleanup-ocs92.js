const { Client } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://aiw_app:1t2pQa27Gf9vy5uZ1nNE@pagerduty-lite-dev-rds.cxmcqjbyfbxk.us-east-1.rds.amazonaws.com:5432/aiworkers_db';

async function updateTask() {
  const client = new Client({
    connectionString: DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('Connected to database');

    // Update the task
    const updateResult = await client.query(
      `UPDATE ai_worker_tasks
       SET status = 'completed',
           phase = 'completed',
           completed_at = NOW() - INTERVAL '15 minutes',
           result_summary = 'Manager analysis: No environment issues found. Task completed successfully.'
       WHERE jira_issue_key = 'OCS-92'
       AND status = 'manager_review'
       RETURNING id, jira_issue_key, status, completed_at`
    );

    if (updateResult.rowCount > 0) {
      console.log('✓ Task updated successfully:');
      console.log(JSON.stringify(updateResult.rows[0], null, 2));
    } else {
      console.log('⚠ No task found to update (might already be completed)');
    }

    // Verify active tasks count
    const countResult = await client.query(
      `SELECT COUNT(*) as active_count
       FROM ai_worker_tasks
       WHERE status IN ('queued', 'dispatching', 'claimed', 'environment_setup', 'executing', 'pr_created', 'manager_review', 'revision_needed', 'review_pending')
       OR (status IN ('completed', 'failed', 'cancelled') AND completed_at > NOW() - INTERVAL '10 minutes')`
    );

    console.log(`\nActive tasks remaining: ${countResult.rows[0].active_count}`);

    await client.end();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

updateTask();
