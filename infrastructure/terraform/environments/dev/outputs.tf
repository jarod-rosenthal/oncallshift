output "vpc_id" {
  description = "ID of the VPC"
  value       = module.networking.vpc_id
}

output "alb_dns_name" {
  description = "DNS name of the Application Load Balancer"
  value       = aws_lb.main.dns_name
}

output "alb_url" {
  description = "URL of the Application Load Balancer"
  value       = "http://${aws_lb.main.dns_name}"
}

output "api_url" {
  description = "API base URL"
  value       = var.acm_certificate_arn != null ? "https://${aws_lb.main.dns_name}/api" : "http://${aws_lb.main.dns_name}/api"
}

output "database_endpoint" {
  description = "Aurora cluster endpoint"
  value       = module.database.cluster_endpoint
}

output "database_secret_arn" {
  description = "ARN of database credentials secret"
  value       = module.database.secret_arn
}

output "cognito_user_pool_id" {
  description = "Cognito User Pool ID"
  value       = aws_cognito_user_pool.main.id
}

output "cognito_user_pool_arn" {
  description = "Cognito User Pool ARN"
  value       = aws_cognito_user_pool.main.arn
}

output "cognito_client_id" {
  description = "Cognito User Pool Client ID for mobile app"
  value       = aws_cognito_user_pool_client.mobile.id
}

output "alerts_queue_url" {
  description = "URL of the alerts SQS queue"
  value       = aws_sqs_queue.alerts.url
}

output "notifications_queue_url" {
  description = "URL of the notifications SQS queue"
  value       = aws_sqs_queue.notifications.url
}

output "api_ecr_repository_url" {
  description = "ECR repository URL for API service"
  value       = module.api_service.ecr_repository_url
}

output "worker_ecr_repository_url" {
  description = "ECR repository URL for notification worker"
  value       = module.notification_worker.ecr_repository_url
}

output "ecs_cluster_name" {
  description = "Name of the ECS cluster"
  value       = aws_ecs_cluster.main.name
}

output "fcm_platform_app_arn" {
  description = "ARN of FCM SNS platform application"
  value       = var.fcm_server_key != null ? aws_sns_platform_application.fcm[0].arn : null
}

output "apns_platform_app_arn" {
  description = "ARN of APNS SNS platform application"
  value       = var.apns_certificate != null ? aws_sns_platform_application.apns[0].arn : null
}

# Instructions for first deployment
output "deployment_instructions" {
  description = "Instructions for deploying the application"
  value = <<-EOT

    ============================================
    PagerDuty-Lite MVP Deployment Instructions
    ============================================

    1. Build and push Docker images:

       # API Service
       cd backend
       docker build -t ${module.api_service.ecr_repository_url}:latest -f Dockerfile.api .
       aws ecr get-login-password --region ${var.aws_region} | docker login --username AWS --password-stdin ${module.api_service.ecr_repository_url}
       docker push ${module.api_service.ecr_repository_url}:latest

       # Notification Worker
       docker build -t ${module.notification_worker.ecr_repository_url}:latest -f Dockerfile.worker .
       docker push ${module.notification_worker.ecr_repository_url}:latest

    2. Run database migrations:

       # Get database credentials
       aws secretsmanager get-secret-value --secret-id ${module.database.secret_name} --query SecretString --output text

       # Run migrations (from backend directory)
       npm run migrate

    3. Configure mobile app:

       API_URL: ${var.acm_certificate_arn != null ? "https://${aws_lb.main.dns_name}/api" : "http://${aws_lb.main.dns_name}/api"}
       COGNITO_USER_POOL_ID: ${aws_cognito_user_pool.main.id}
       COGNITO_CLIENT_ID: ${aws_cognito_user_pool_client.mobile.id}
       AWS_REGION: ${var.aws_region}

    4. Create first organization and user:

       # Use Cognito or API to create first admin user
       # Then use API to create organization

    5. Test webhook:

       curl -X POST ${var.acm_certificate_arn != null ? "https" : "http"}://${aws_lb.main.dns_name}/api/v1/alerts/webhook \
         -H "Content-Type: application/json" \
         -H "X-API-Key: YOUR_API_KEY" \
         -d '{
           "service_key": "your-service-key",
           "summary": "Test alert from curl",
           "severity": "critical"
         }'

    ============================================
    EOT
}
