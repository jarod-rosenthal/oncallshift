#!/usr/bin/env ts-node
/**
 * Cancel a stuck AI worker task
 * Usage: npx ts-node scripts/cancel-stuck-task.ts <jira-issue-key>
 */

import { getDataSource } from '../src/shared/db/data-source';
import { AIWorkerTask } from '../src/shared/models/AIWorkerTask';

async function cancelTask(jiraIssueKey: string) {
  const dataSource = await getDataSource();
  const taskRepo = dataSource.getRepository(AIWorkerTask);

  try {
    // Find the task
    const task = await taskRepo.findOne({
      where: { jiraIssueKey },
      order: { createdAt: 'DESC' },
    });

    if (!task) {
      console.log(`Task ${jiraIssueKey} not found`);
      process.exit(1);
    }

    console.log(`Found task ${jiraIssueKey}:`);
    console.log(`  ID: ${task.id}`);
    console.log(`  Status: ${task.status}`);
    console.log(`  Summary: ${task.summary}`);
    console.log(`  Is active: ${task.isActive()}`);

    if (task.isComplete()) {
      console.log(`\nTask is already complete. No action needed.`);
      await dataSource.destroy();
      process.exit(0);
    }

    // Update the task to failed status
    task.status = 'failed';
    task.completedAt = new Date();
    task.errorMessage = 'Task manually cancelled - stuck in execution';

    await taskRepo.save(task);

    console.log(`\nTask ${jiraIssueKey} has been marked as failed.`);
    console.log(`  New status: ${task.status}`);
    console.log(`  Completed at: ${task.completedAt}`);
    console.log(`  Is active: ${task.isActive()}`);

    await dataSource.destroy();
  } catch (error) {
    console.error('Error cancelling task:', error);
    await dataSource.destroy();
    process.exit(1);
  }
}

const jiraIssueKey = process.argv[2];
if (!jiraIssueKey) {
  console.error('Usage: npx ts-node scripts/cancel-stuck-task.ts <jira-issue-key>');
  process.exit(1);
}

cancelTask(jiraIssueKey).catch(console.error);
