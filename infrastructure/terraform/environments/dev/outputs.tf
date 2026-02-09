# Cognito
output "cognito_user_pool_id" {
  description = "Cognito User Pool ID — use as COGNITO_USER_POOL_ID env var"
  value       = module.cognito.user_pool_id
}

output "cognito_client_id" {
  description = "Cognito User Pool Client ID — use as COGNITO_CLIENT_ID env var"
  value       = module.cognito.client_id
}

output "cognito_user_pool_arn" {
  description = "Cognito User Pool ARN"
  value       = module.cognito.user_pool_arn
}

# SQS
output "alerts_queue_url" {
  description = "SQS alerts queue URL — use as ALERTS_QUEUE_URL env var"
  value       = module.sqs.alerts_queue_url
}

output "notifications_queue_url" {
  description = "SQS notifications queue URL — use as NOTIFICATIONS_QUEUE_URL env var"
  value       = module.sqs.notifications_queue_url
}

output "alerts_dlq_url" {
  description = "SQS alerts dead letter queue URL"
  value       = module.sqs.alerts_dlq_url
}

output "notifications_dlq_url" {
  description = "SQS notifications dead letter queue URL"
  value       = module.sqs.notifications_dlq_url
}

# SES
output "ses_domain_identity_arn" {
  description = "SES domain identity ARN"
  value       = module.ses.domain_identity_arn
}

output "ses_domain_verification_token" {
  description = "SES domain verification token — add as TXT record in DNS"
  value       = module.ses.domain_identity_verification_token
}

output "ses_dkim_tokens" {
  description = "SES DKIM tokens — add as CNAME records in DNS"
  value       = module.ses.dkim_tokens
}

output "ses_from_email" {
  description = "Verified SES from email — use as SES_FROM_EMAIL env var"
  value       = module.ses.from_email
}

# SNS
output "sns_push_topic_arn" {
  description = "SNS push events topic ARN — use as SNS_PUSH_TOPIC_ARN env var"
  value       = module.sns.push_topic_arn
}

output "sns_fcm_platform_application_arn" {
  description = "SNS FCM platform application ARN (empty if FCM key not provided)"
  value       = module.sns.fcm_platform_application_arn
}

# S3
output "s3_uploads_bucket" {
  description = "S3 uploads bucket name — use as S3_UPLOADS_BUCKET env var"
  value       = module.s3.uploads_bucket_name
}

output "s3_uploads_bucket_arn" {
  description = "S3 uploads bucket ARN"
  value       = module.s3.uploads_bucket_arn
}

# Secrets Manager
output "encryption_key_secret_arn" {
  description = "Secrets Manager ARN for the encryption key"
  value       = module.secrets_manager.encryption_key_secret_arn
}

output "encryption_key_secret_name" {
  description = "Secrets Manager name for the encryption key"
  value       = module.secrets_manager.encryption_key_secret_name
}
