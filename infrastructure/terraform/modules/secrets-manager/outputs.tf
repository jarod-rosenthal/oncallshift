output "encryption_key_secret_arn" {
  description = "Secrets Manager ARN for the encryption key"
  value       = aws_secretsmanager_secret.encryption_key.arn
}

output "encryption_key_secret_name" {
  description = "Secrets Manager name for the encryption key"
  value       = aws_secretsmanager_secret.encryption_key.name
}
