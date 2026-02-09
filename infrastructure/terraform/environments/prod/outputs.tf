# ------------------------------------------------------------------------------
# Networking Outputs
# ------------------------------------------------------------------------------

output "vpc_id" {
  description = "ID of the VPC"
  value       = module.networking.vpc_id
}

output "vpc_cidr_block" {
  description = "CIDR block of the VPC"
  value       = module.networking.vpc_cidr_block
}

output "public_subnet_ids" {
  description = "IDs of the public subnets"
  value       = module.networking.public_subnet_ids
}

output "private_subnet_ids" {
  description = "IDs of the private subnets"
  value       = module.networking.private_subnet_ids
}

output "nat_gateway_public_ip" {
  description = "Public IP of the NAT gateway"
  value       = module.networking.nat_gateway_public_ip
}

output "runner_security_group_id" {
  description = "ID of the runner security group"
  value       = module.networking.runner_security_group_id
}

output "alb_security_group_id" {
  description = "ID of the ALB security group"
  value       = module.networking.alb_security_group_id
}

output "ecs_security_group_id" {
  description = "ID of the ECS security group"
  value       = module.networking.ecs_security_group_id
}

output "rds_security_group_id" {
  description = "ID of the RDS security group"
  value       = module.networking.rds_security_group_id
}

# ------------------------------------------------------------------------------
# GitHub Actions Runner Outputs
# ------------------------------------------------------------------------------

output "runner_instance_id" {
  description = "ID of the runner EC2 instance"
  value       = module.github_runner.instance_id
}

output "runner_private_ip" {
  description = "Private IP of the runner EC2 instance"
  value       = module.github_runner.instance_private_ip
}

output "runner_iam_role_arn" {
  description = "ARN of the runner IAM role"
  value       = module.github_runner.iam_role_arn
}

# ------------------------------------------------------------------------------
# GitHub Actions OIDC Outputs
# ------------------------------------------------------------------------------

output "github_actions_role_arn" {
  description = "ARN of the GitHub Actions OIDC IAM role"
  value       = aws_iam_role.github_actions.arn
}

output "github_oidc_provider_arn" {
  description = "ARN of the GitHub OIDC provider"
  value       = aws_iam_openid_connect_provider.github_actions.arn
}
