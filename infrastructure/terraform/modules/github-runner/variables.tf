variable "project" {
  description = "Project name used for resource naming"
  type        = string
  default     = "oncallshift"
}

variable "environment" {
  description = "Environment name (prod, dev, staging)"
  type        = string
  default     = "prod"
}

variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  default     = "us-east-2"
}

variable "vpc_id" {
  description = "VPC ID where the runner will be deployed"
  type        = string
}

variable "subnet_id" {
  description = "Private subnet ID for the runner EC2 instance"
  type        = string
}

variable "security_group_id" {
  description = "Security group ID for the runner"
  type        = string
}

variable "instance_type" {
  description = "EC2 instance type for the runner"
  type        = string
  default     = "t3.medium"
}

variable "runner_version" {
  description = "GitHub Actions runner version"
  type        = string
  default     = "2.321.0"
}

variable "github_owner" {
  description = "GitHub repository owner"
  type        = string
  default     = "jarod-rosenthal"
}

variable "github_repo" {
  description = "GitHub repository name"
  type        = string
  default     = "oncallshift"
}

variable "runner_labels" {
  description = "Labels for the GitHub Actions runner"
  type        = list(string)
  default     = ["self-hosted", "oncallshift", "linux", "x64"]
}

variable "runner_token_secret_arn" {
  description = "ARN of the Secrets Manager secret containing the GitHub runner registration token"
  type        = string
}

variable "root_volume_size" {
  description = "Size of the root EBS volume in GB"
  type        = number
  default     = 30
}

variable "tags" {
  description = "Additional tags to apply to all resources"
  type        = map(string)
  default     = {}
}
