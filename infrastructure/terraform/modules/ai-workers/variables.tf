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

variable "enable_watcher" {
  description = "Enable the AI Worker Watcher Lambda"
  type        = bool
  default     = true
}

variable "database_secret_arn" {
  description = "ARN of the Secrets Manager secret containing database credentials"
  type        = string
  default     = ""
}

variable "watcher_schedule" {
  description = "CloudWatch Events schedule expression for the Watcher Lambda"
  type        = string
  default     = "rate(5 minutes)"
}

variable "enable_manager" {
  description = "Enable the AI Worker Manager Lambda (Virtual Manager for PR reviews)"
  type        = bool
  default     = true
}

variable "manager_schedule" {
  description = "CloudWatch Events schedule expression for the Manager Lambda"
  type        = string
  default     = "rate(2 minutes)"
}

variable "anthropic_api_key" {
  description = "Anthropic API key for the Manager Lambda (uses Opus for PR reviews)"
  type        = string
  default     = ""
  sensitive   = true
}

variable "github_token" {
  description = "GitHub token for fetching PR diffs"
  type        = string
  default     = ""
  sensitive   = true
}

variable "lambda_security_group_ids" {
  description = "Security group IDs for Lambda functions in VPC"
  type        = list(string)
  default     = []
}

variable "jira_credentials_secret_arn" {
  description = "ARN of the Secrets Manager secret containing Jira API credentials (baseUrl, email, apiToken)"
  type        = string
  default     = ""
}

variable "api_base_url" {
  description = "Base URL for the OnCallShift API (e.g., https://oncallshift.com)"
  type        = string
  default     = "https://oncallshift.com"
}

variable "org_api_key_secret_arn" {
  description = "ARN of the Secrets Manager secret containing the org API key for executor authentication"
  type        = string
  default     = ""
}

# Terraform state access for AI Workers
variable "terraform_state_bucket" {
  description = "S3 bucket name containing Terraform state (enables terraform plan)"
  type        = string
  default     = ""
}

variable "terraform_state_dynamodb_table" {
  description = "DynamoDB table name for Terraform state locking"
  type        = string
  default     = ""
}

variable "terraform_write_access" {
  description = "Allow AI Workers to run terraform apply (default: false, read-only for terraform plan)"
  type        = bool
  default     = false
}

# Manager Executor settings (Manager runs as ECS like workers)
variable "manager_executor_cpu" {
  description = "CPU units for the Manager executor task (1024 = 1 vCPU)"
  type        = number
  default     = 2048  # 2 vCPU for Claude Code CLI
}

variable "manager_executor_memory" {
  description = "Memory for the Manager executor task in MB"
  type        = number
  default     = 4096  # 4 GB
}
