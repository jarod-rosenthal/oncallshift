# =============================================================================
# Networking Outputs
# =============================================================================

output "vpc_id" {
  description = "ID of the VPC"
  value       = module.networking.vpc_id
}

output "vpc_cidr" {
  description = "CIDR block of the VPC"
  value       = module.networking.vpc_cidr
}

output "public_subnet_ids" {
  description = "IDs of public subnets"
  value       = module.networking.public_subnet_ids
}

output "private_subnet_ids" {
  description = "IDs of private subnets"
  value       = module.networking.private_subnet_ids
}

output "alb_security_group_id" {
  description = "Security group ID for the ALB"
  value       = module.networking.alb_security_group_id
}

output "ecs_security_group_id" {
  description = "Security group ID for ECS services"
  value       = module.networking.ecs_security_group_id
}

output "rds_security_group_id" {
  description = "Security group ID for RDS"
  value       = module.networking.rds_security_group_id
}

output "runner_security_group_id" {
  description = "Security group ID for the GitHub Actions runner"
  value       = module.networking.runner_security_group_id
}

# =============================================================================
# GitHub Runner Outputs
# =============================================================================

output "runner_instance_id" {
  description = "EC2 instance ID of the GitHub Actions runner"
  value       = module.github_runner.runner_instance_id
}

output "runner_private_ip" {
  description = "Private IP of the runner"
  value       = module.github_runner.runner_private_ip
}

output "github_actions_oidc_provider_arn" {
  description = "ARN of the GitHub Actions OIDC provider"
  value       = module.github_runner.github_actions_oidc_provider_arn
}

output "github_actions_role_arn" {
  description = "ARN of the IAM role for GitHub Actions OIDC workflows"
  value       = module.github_runner.github_actions_role_arn
}
