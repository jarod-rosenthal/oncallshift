variable "project_name" {
  description = "Name of the project"
  type        = string
}

variable "environment" {
  description = "Deployment environment (dev, staging, prod)"
  type        = string
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "ecs_cluster_arn" {
  description = "ARN of the ECS cluster"
  type        = string
}

variable "ecs_cluster_name" {
  description = "Name of the ECS cluster"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID for the ECS tasks"
  type        = string
}

variable "private_subnet_ids" {
  description = "Private subnet IDs for the ECS tasks"
  type        = list(string)
}

variable "security_group_ids" {
  description = "Security group IDs for the ECS tasks"
  type        = list(string)
}

variable "secrets_arns" {
  description = "List of Secrets Manager secret ARNs the tasks can access"
  type        = list(string)
  default     = []
}

variable "github_token_secret_arn" {
  description = "ARN of the Secrets Manager secret containing the GitHub PAT"
  type        = string
}

variable "anthropic_api_key_secret_arn" {
  description = "ARN of the Secrets Manager secret containing the Anthropic API key"
  type        = string
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 30
}

variable "executor_cpu" {
  description = "CPU units for the executor task (1024 = 1 vCPU)"
  type        = number
  default     = 2048  # 2 vCPU for Claude Code CLI
}

variable "executor_memory" {
  description = "Memory for the executor task in MB"
  type        = number
  default     = 4096  # 4 GB
}

variable "orchestrator_cpu" {
  description = "CPU units for the orchestrator service (1024 = 1 vCPU)"
  type        = number
  default     = 512  # 0.5 vCPU
}

variable "orchestrator_memory" {
  description = "Memory for the orchestrator service in MB"
  type        = number
  default     = 1024  # 1 GB
}

variable "enable_spot" {
  description = "Use Fargate Spot for executor tasks to reduce costs"
  type        = bool
  default     = true
}
