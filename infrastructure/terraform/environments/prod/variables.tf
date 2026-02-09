# =============================================================================
# Global
# =============================================================================

variable "project" {
  description = "Project name used for resource naming"
  type        = string
  default     = "oncallshift"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "prod"
}

variable "aws_region" {
  description = "AWS region for all resources"
  type        = string
  default     = "us-east-2"
}

# =============================================================================
# Networking
# =============================================================================

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "Availability zones (2 AZs)"
  type        = list(string)
  default     = ["us-east-2a", "us-east-2b"]
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for public subnets"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24"]
}

variable "private_subnet_cidrs" {
  description = "CIDR blocks for private subnets"
  type        = list(string)
  default     = ["10.0.10.0/24", "10.0.11.0/24"]
}

# =============================================================================
# GitHub Runner
# =============================================================================

variable "runner_instance_type" {
  description = "EC2 instance type for the GitHub Actions runner"
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

variable "runner_token_secret_arn" {
  description = "ARN of the Secrets Manager secret containing the GitHub runner registration token. Must be created manually before first apply."
  type        = string
}
