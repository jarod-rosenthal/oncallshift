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

variable "db_min_capacity" {
  description = "Minimum ACU for Aurora Serverless v2"
  type        = number
  default     = 0.5
}

variable "db_max_capacity" {
  description = "Maximum ACU for Aurora Serverless v2"
  type        = number
  default     = 2
}

variable "db_backup_retention_days" {
  description = "Number of days to retain database backups"
  type        = number
  default     = 7
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
  default     = false
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 7
}

variable "acm_certificate_arn" {
  description = "ARN of ACM certificate for HTTPS (optional for MVP)"
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
