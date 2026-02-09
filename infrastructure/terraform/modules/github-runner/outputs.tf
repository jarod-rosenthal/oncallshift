output "instance_id" {
  description = "ID of the runner EC2 instance"
  value       = aws_instance.runner.id
}

output "instance_private_ip" {
  description = "Private IP address of the runner"
  value       = aws_instance.runner.private_ip
}

output "iam_role_arn" {
  description = "ARN of the runner IAM role"
  value       = aws_iam_role.runner.arn
}

output "iam_role_name" {
  description = "Name of the runner IAM role"
  value       = aws_iam_role.runner.name
}

output "instance_profile_arn" {
  description = "ARN of the runner instance profile"
  value       = aws_iam_instance_profile.runner.arn
}
