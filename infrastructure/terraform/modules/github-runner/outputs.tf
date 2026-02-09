output "runner_instance_id" {
  description = "EC2 instance ID of the GitHub Actions runner"
  value       = aws_instance.runner.id
}

output "runner_private_ip" {
  description = "Private IP address of the runner"
  value       = aws_instance.runner.private_ip
}

output "runner_iam_role_arn" {
  description = "ARN of the runner IAM role"
  value       = aws_iam_role.runner.arn
}

output "runner_instance_profile_arn" {
  description = "ARN of the runner instance profile"
  value       = aws_iam_instance_profile.runner.arn
}

output "github_actions_oidc_provider_arn" {
  description = "ARN of the GitHub Actions OIDC provider"
  value       = aws_iam_openid_connect_provider.github.arn
}

output "github_actions_role_arn" {
  description = "ARN of the IAM role for GitHub Actions OIDC"
  value       = aws_iam_role.github_actions.arn
}
