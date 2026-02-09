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

variable "instance_type" {
  description = "EC2 instance type for the runner"
  type        = string
  default     = "t3.medium"
}

variable "subnet_id" {
  description = "Subnet ID where the runner will be placed (should be private)"
  type        = string
}

variable "security_group_id" {
  description = "Security group ID for the runner"
  type        = string
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

variable "github_runner_token" {
  description = "GitHub Actions runner registration token"
  type        = string
  sensitive   = true
}

variable "runner_labels" {
  description = "Labels for the GitHub Actions runner"
  type        = list(string)
  default     = ["oncallshift"]
}

variable "runner_version" {
  description = "Version of the GitHub Actions runner to install"
  type        = string
  default     = "2.322.0"
}

variable "root_volume_size" {
  description = "Size of the root EBS volume in GB"
  type        = number
  default     = 30
}

variable "vpc_id" {
  description = "VPC ID (used for SSM endpoint access)"
  type        = string
}

variable "tags" {
  description = "Additional tags to apply to all resources"
  type        = map(string)
  default     = {}
}
