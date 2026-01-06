output "instance_id" {
  description = "ID of the RDS instance"
  value       = aws_db_instance.main.id
}

output "cluster_endpoint" {
  description = "Endpoint for the RDS instance (kept for compatibility)"
  value       = aws_db_instance.main.address
}

output "instance_endpoint" {
  description = "Endpoint for the RDS instance"
  value       = aws_db_instance.main.address
}

output "instance_port" {
  description = "Port of the RDS instance"
  value       = aws_db_instance.main.port
}

output "cluster_port" {
  description = "Port of the RDS instance (kept for compatibility)"
  value       = aws_db_instance.main.port
}

output "database_name" {
  description = "Name of the default database"
  value       = aws_db_instance.main.db_name
}

output "master_username" {
  description = "Master username"
  value       = aws_db_instance.main.username
  sensitive   = true
}

output "secret_arn" {
  description = "ARN of the Secrets Manager secret containing database credentials"
  value       = aws_secretsmanager_secret.db_master_password.arn
}

output "secret_name" {
  description = "Name of the Secrets Manager secret"
  value       = aws_secretsmanager_secret.db_master_password.name
}

output "proxy_endpoint" {
  description = "Endpoint for the RDS Proxy (for connection pooling)"
  value       = var.enable_rds_proxy ? aws_db_proxy.main[0].endpoint : null
}

output "proxy_arn" {
  description = "ARN of the RDS Proxy"
  value       = var.enable_rds_proxy ? aws_db_proxy.main[0].arn : null
}
