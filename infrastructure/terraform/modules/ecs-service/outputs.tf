output "ecr_repository_url" {
  description = "URL of the ECR repository (created or provided)"
  value       = local.effective_ecr_repository_url
}

output "ecr_repository_arn" {
  description = "ARN of the ECR repository (null if using external repo)"
  value       = var.ecr_repository_url == null ? aws_ecr_repository.app[0].arn : null
}

output "ecs_cluster_id" {
  description = "ID of the ECS cluster"
  value       = var.ecs_cluster_id
}

output "ecs_cluster_name" {
  description = "Name of the ECS cluster"
  value       = local.cluster_name
}

output "ecs_service_name" {
  description = "Name of the ECS service"
  value       = aws_ecs_service.app.name
}

output "ecs_service_id" {
  description = "ID of the ECS service"
  value       = aws_ecs_service.app.id
}

output "task_definition_arn" {
  description = "ARN of the task definition"
  value       = aws_ecs_task_definition.app.arn
}

output "task_execution_role_arn" {
  description = "ARN of the task execution role"
  value       = aws_iam_role.ecs_execution_role.arn
}

output "task_role_arn" {
  description = "ARN of the task role"
  value       = aws_iam_role.ecs_task_role.arn
}

output "cloudwatch_log_group_name" {
  description = "Name of the CloudWatch log group"
  value       = aws_cloudwatch_log_group.app.name
}
