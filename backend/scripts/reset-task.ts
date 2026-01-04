import { getDataSource, closeDataSource } from '../src/shared/db/data-source';
import { AIWorkerTask } from '../src/shared/models/AIWorkerTask';

async function resetTask() {
  const dataSource = await getDataSource();

  const task = await dataSource.getRepository(AIWorkerTask).findOne({
    where: { jiraIssueKey: 'OCS-55' },
  });

  if (!task) {
    console.log('Task OCS-55 not found');
    await closeDataSource();
    return;
  }

  console.log('Found task:', task.id, 'Status:', task.status);

  // Reset the task to queued status
  task.status = 'queued';
  task.retryCount = 0;
  task.ecsTaskArn = null;
  task.ecsTaskId = null;
  task.startedAt = null;
  task.completedAt = null;
  task.githubPrUrl = null;
  task.githubPrNumber = null;
  task.githubBranch = null;
  task.errorMessage = null;
  task.failureCategory = null;
  task.claudeInputTokens = 0;
  task.claudeOutputTokens = 0;
  task.estimatedCostUsd = 0;
  task.previousRunContext = null;
  task.lastHeartbeatAt = null;

  await dataSource.getRepository(AIWorkerTask).save(task);
  console.log('Task reset to queued status');

  await closeDataSource();
}

resetTask().catch(console.error);
