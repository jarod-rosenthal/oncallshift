#!/usr/bin/env ts-node
/**
 * Cancel an AI worker task by Jira issue key
 * Usage: npx ts-node scripts/cancel-task-by-jira-key.ts <jira-issue-key>
 *
 * This script can be run directly on ECS via exec:
 * aws ecs execute-command --cluster pagerduty-lite-dev \
 *   --task <task-id> --container api --interactive \
 *   --command "cd /app && npx ts-node scripts/cancel-task-by-jira-key.ts OCS-91"
 */

import { getDataSource } from '../src/shared/db/data-source';
import { AIWorkerTask } from '../src/shared/models/AIWorkerTask';

async function cancelTaskByJiraKey(jiraIssueKey: string) {
  const dataSource = await getDataSource();
  const taskRepo = dataSource.getRepository(AIWorkerTask);

  try {
    // Find all active tasks with this Jira issue key
    const tasks = await taskRepo
      .createQueryBuilder('task')
      .where('task.jiraIssueKey = :jiraIssueKey', { jiraIssueKey })
      .andWhere('task.status NOT IN (:...completedStatuses)', {
        completedStatuses: ['completed', 'failed', 'cancelled'],
      })
      .orderBy('task.createdAt', 'DESC')
      .getMany();

    if (tasks.length === 0) {
      console.log(`No active tasks found for ${jiraIssueKey}`);
      await dataSource.destroy();
      process.exit(0);
    }

    console.log(`Found ${tasks.length} active task(s) for ${jiraIssueKey}:`);

    for (const task of tasks) {
      console.log(`\n  Task ID: ${task.id}`);
      console.log(`  Status: ${task.status}`);
      console.log(`  Summary: ${task.summary}`);
      console.log(`  Created: ${task.createdAt}`);

      // Update to failed status
      task.status = 'failed';
      task.completedAt = new Date();
      task.errorMessage = 'Task manually cancelled via cancel-task-by-jira-key.ts - stuck in execution';

      await taskRepo.save(task);
      console.log(`  ✓ Marked as failed`);
    }

    console.log(`\nSuccessfully cancelled ${tasks.length} task(s)`);
    await dataSource.destroy();
    process.exit(0);
  } catch (error) {
    console.error('Error cancelling task:', error);
    await dataSource.destroy();
    process.exit(1);
  }
}

const jiraIssueKey = process.argv[2];
if (!jiraIssueKey) {
  console.error('Usage: npx ts-node scripts/cancel-task-by-jira-key.ts <jira-issue-key>');
  process.exit(1);
}

cancelTaskByJiraKey(jiraIssueKey).catch(console.error);
