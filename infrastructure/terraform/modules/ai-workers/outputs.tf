output "sqs_queue_url" {
  description = "URL of the AI Worker tasks SQS queue"
  value       = aws_sqs_queue.ai_worker_tasks.url
}

output "sqs_queue_arn" {
  description = "ARN of the AI Worker tasks SQS queue"
  value       = aws_sqs_queue.ai_worker_tasks.arn
}

output "sqs_dlq_url" {
  description = "URL of the AI Worker tasks dead letter queue"
  value       = aws_sqs_queue.ai_worker_tasks_dlq.url
}

output "sqs_dlq_arn" {
  description = "ARN of the AI Worker tasks dead letter queue"
  value       = aws_sqs_queue.ai_worker_tasks_dlq.arn
}

output "ecr_repository_url" {
  description = "URL of the AI Worker ECR repository"
  value       = aws_ecr_repository.ai_worker.repository_url
}

output "ecr_repository_arn" {
  description = "ARN of the AI Worker ECR repository"
  value       = aws_ecr_repository.ai_worker.arn
}

output "executor_task_definition_arn" {
  description = "ARN of the AI Worker executor task definition"
  value       = aws_ecs_task_definition.executor.arn
}

output "executor_task_definition_family" {
  description = "Family name of the AI Worker executor task definition"
  value       = aws_ecs_task_definition.executor.family
}

output "orchestrator_execution_role_arn" {
  description = "ARN of the orchestrator execution role"
  value       = aws_iam_role.orchestrator_execution_role.arn
}

output "orchestrator_task_role_arn" {
  description = "ARN of the orchestrator task role"
  value       = aws_iam_role.orchestrator_task_role.arn
}

output "executor_execution_role_arn" {
  description = "ARN of the executor execution role"
  value       = aws_iam_role.executor_execution_role.arn
}

output "executor_task_role_arn" {
  description = "ARN of the executor task role"
  value       = aws_iam_role.executor_task_role.arn
}

output "orchestrator_log_group_name" {
  description = "Name of the orchestrator CloudWatch log group"
  value       = aws_cloudwatch_log_group.orchestrator.name
}

output "executor_log_group_name" {
  description = "Name of the executor CloudWatch log group"
  value       = aws_cloudwatch_log_group.executor.name
}

output "watcher_lambda_arn" {
  description = "ARN of the AI Worker Watcher Lambda function"
  value       = var.enable_watcher ? aws_lambda_function.watcher[0].arn : null
}

output "watcher_lambda_name" {
  description = "Name of the AI Worker Watcher Lambda function"
  value       = var.enable_watcher ? aws_lambda_function.watcher[0].function_name : null
}

output "watcher_log_group_name" {
  description = "Name of the watcher CloudWatch log group"
  value       = var.enable_watcher ? aws_cloudwatch_log_group.watcher[0].name : null
}
