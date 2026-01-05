variable "project_name" {
  description = "Name of the project"
  type        = string
  default     = "pagerduty-lite"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "dev"
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "az_count" {
  description = "Number of availability zones to use"
  type        = number
  default     = 2
}

variable "database_name" {
  description = "Name of the database"
  type        = string
  default     = "pagerduty_lite"
}

variable "db_instance_class" {
  description = "RDS instance class (db.t4g.micro for POC, db.t4g.small for dev, db.t4g.medium for prod)"
  type        = string
  default     = "db.t4g.micro"
}

variable "db_allocated_storage" {
  description = "Initial allocated storage in GB"
  type        = number
  default     = 20
}

variable "db_max_allocated_storage" {
  description = "Maximum storage for autoscaling in GB"
  type        = number
  default     = 100
}

variable "db_backup_retention_days" {
  description = "Number of days to retain database backups"
  type        = number
  default     = 7
}

variable "db_deletion_protection" {
  description = "Enable deletion protection for RDS instance"
  type        = bool
  default     = true
}

variable "api_desired_count" {
  description = "Desired number of API tasks"
  type        = number
  default     = 1
}

variable "worker_desired_count" {
  description = "Desired number of worker tasks"
  type        = number
  default     = 1
}

variable "enable_container_insights" {
  description = "Enable CloudWatch Container Insights"
  type        = bool
  default     = true
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 7
}

variable "use_fargate_spot" {
  description = "Use Fargate Spot for cost savings (up to 70% cheaper)"
  type        = bool
  default     = true
}

variable "fargate_spot_percentage" {
  description = "Percentage of tasks to run on Fargate Spot (0-100, recommended 70-100 for dev)"
  type        = number
  default     = 100
}

variable "acm_certificate_arn" {
  description = "ARN of ACM certificate for HTTPS (optional for MVP, use domain_name instead for auto-generated cert)"
  type        = string
  default     = null
}

variable "domain_name" {
  description = "Domain name for the application (e.g., oncallshift.com). Will create ACM certificate and Route53 records."
  type        = string
  default     = null
}

# Push notification credentials (set via environment variables or tfvars)
variable "fcm_server_key" {
  description = "Firebase Cloud Messaging server key"
  type        = string
  default     = null
  sensitive   = true
}

variable "apns_certificate" {
  description = "Apple Push Notification Service certificate (PEM format)"
  type        = string
  default     = null
  sensitive   = true
}

variable "apns_private_key" {
  description = "Apple Push Notification Service private key (PEM format)"
  type        = string
  default     = null
  sensitive   = true
}

variable "apns_use_sandbox" {
  description = "Use APNS sandbox environment"
  type        = bool
  default     = true
}

# GitHub Actions OIDC
variable "github_org" {
  description = "GitHub organization/user name for OIDC authentication"
  type        = string
  default     = null
}

variable "github_repo" {
  description = "GitHub repository name for OIDC authentication"
  type        = string
  default     = null
}

# Sentry configuration
variable "sentry_enabled" {
  description = "Enable Sentry error tracking. DSN is stored in Secrets Manager."
  type        = bool
  default     = false
}
