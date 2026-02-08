output "alerts_queue_url" {
  description = "SQS alerts queue URL"
  value       = aws_sqs_queue.alerts.url
}

output "alerts_queue_arn" {
  description = "SQS alerts queue ARN"
  value       = aws_sqs_queue.alerts.arn
}

output "notifications_queue_url" {
  description = "SQS notifications queue URL"
  value       = aws_sqs_queue.notifications.url
}

output "notifications_queue_arn" {
  description = "SQS notifications queue ARN"
  value       = aws_sqs_queue.notifications.arn
}

output "alerts_dlq_url" {
  description = "SQS alerts dead letter queue URL"
  value       = aws_sqs_queue.alerts_dlq.url
}

output "alerts_dlq_arn" {
  description = "SQS alerts dead letter queue ARN"
  value       = aws_sqs_queue.alerts_dlq.arn
}

output "notifications_dlq_url" {
  description = "SQS notifications dead letter queue URL"
  value       = aws_sqs_queue.notifications_dlq.url
}

output "notifications_dlq_arn" {
  description = "SQS notifications dead letter queue ARN"
  value       = aws_sqs_queue.notifications_dlq.arn
}
