# ------------------------------------------------------------------------------
# General
# ------------------------------------------------------------------------------

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
  description = "AWS region for all resources"
  type        = string
  default     = "us-east-2"
}

variable "aws_account_id" {
  description = "AWS account ID"
  type        = string
  default     = "593971626975"
}

# ------------------------------------------------------------------------------
# Networking
# ------------------------------------------------------------------------------

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
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

variable "availability_zones" {
  description = "Availability zones to deploy into"
  type        = list(string)
  default     = ["us-east-2a", "us-east-2b"]
}

# ------------------------------------------------------------------------------
# GitHub Actions Runner
# ------------------------------------------------------------------------------

variable "runner_instance_type" {
  description = "EC2 instance type for the GitHub Actions runner"
  type        = string
  default     = "t3.medium"
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
  description = "GitHub Actions runner registration token (set via terraform.tfvars or -var)"
  type        = string
  sensitive   = true
  default     = ""
}

# ------------------------------------------------------------------------------
# GitHub Actions OIDC
# ------------------------------------------------------------------------------

variable "github_oidc_thumbprint" {
  description = "TLS certificate thumbprint for GitHub OIDC provider"
  type        = string
  default     = "6938fd4d98bab03faadb97b34396831e3780aea1"
}
