# OnCallShift Production Environment
# All variables have defaults in variables.tf — this file only overrides where needed.

project     = "oncallshift"
environment = "prod"
aws_region  = "us-east-2"

# Networking
vpc_cidr             = "10.0.0.0/16"
public_subnet_cidrs  = ["10.0.1.0/24", "10.0.2.0/24"]
private_subnet_cidrs = ["10.0.10.0/24", "10.0.11.0/24"]
availability_zones   = ["us-east-2a", "us-east-2b"]

# GitHub Actions Runner
runner_instance_type = "t3.medium"
github_owner         = "jarod-rosenthal"
github_repo          = "oncallshift"

# github_runner_token is set via terraform.tfvars.local (gitignored) or environment variable
# TF_VAR_github_runner_token=ghp_xxx
