variable "project_name" {
  description = "Name of the project"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "aws_region" {
  description = "AWS region"
  type        = string
}

variable "service_name" {
  description = "Name of the service"
  type        = string
}

variable "ecs_cluster_id" {
  description = "ECS cluster ID (if null, creates new cluster)"
  type        = string
  default     = null
}

variable "private_subnet_ids" {
  description = "List of private subnet IDs"
  type        = list(string)
}

variable "security_group_id" {
  description = "Security group ID for ECS tasks"
  type        = string
}

variable "task_cpu" {
  description = "CPU units for the task (256, 512, 1024, 2048, 4096)"
  type        = string
  default     = "256"
}

variable "task_memory" {
  description = "Memory for the task in MB"
  type        = string
  default     = "512"
}

variable "desired_count" {
  description = "Desired number of tasks"
  type        = number
  default     = 1
}

variable "container_port" {
  description = "Container port (null for worker services)"
  type        = number
  default     = null
}

variable "image_tag" {
  description = "Docker image tag"
  type        = string
  default     = "latest"
}

variable "environment_variables" {
  description = "Environment variables for the container"
  type        = map(string)
  default     = {}
}

variable "secrets" {
  description = "Secrets from Secrets Manager (map of name to ARN)"
  type        = map(string)
  default     = {}
}

variable "secrets_arns" {
  description = "List of Secrets Manager ARNs that execution role can access"
  type        = list(string)
  default     = []
}

variable "sqs_queue_arns" {
  description = "List of SQS queue ARNs for task role"
  type        = list(string)
  default     = []
}

variable "sns_topic_arns" {
  description = "List of SNS topic ARNs for task role"
  type        = list(string)
  default     = []
}

variable "additional_task_policy_statements" {
  description = "Additional IAM policy statements for task role"
  type        = list(any)
  default     = []
}

variable "command" {
  description = "Command to run in container (overrides Dockerfile CMD)"
  type        = list(string)
  default     = null
}

variable "health_check" {
  description = "Health check configuration for container"
  type = object({
    command     = list(string)
    interval    = number
    timeout     = number
    retries     = number
    startPeriod = number
  })
  default = null
}

variable "target_group_arn" {
  description = "ALB target group ARN (for API services)"
  type        = string
  default     = null
}

variable "alb_listener_arn" {
  description = "ALB listener ARN (for dependency)"
  type        = string
  default     = null
}

variable "enable_autoscaling" {
  description = "Enable auto scaling"
  type        = bool
  default     = false
}

variable "autoscaling_min_capacity" {
  description = "Minimum number of tasks"
  type        = number
  default     = 1
}

variable "autoscaling_max_capacity" {
  description = "Maximum number of tasks"
  type        = number
  default     = 4
}

variable "autoscaling_cpu_target" {
  description = "Target CPU utilization for scaling"
  type        = number
  default     = 70
}

variable "autoscaling_memory_target" {
  description = "Target memory utilization for scaling"
  type        = number
  default     = 80
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 7
}

variable "enable_container_insights" {
  description = "Enable Container Insights for the cluster"
  type        = bool
  default     = false
}

variable "use_fargate_spot" {
  description = "Use Fargate Spot capacity provider (true for cost savings, false for on-demand)"
  type        = bool
  default     = false
}

variable "fargate_spot_percentage" {
  description = "Percentage of tasks to run on Fargate Spot (0-100)"
  type        = number
  default     = 70
}
