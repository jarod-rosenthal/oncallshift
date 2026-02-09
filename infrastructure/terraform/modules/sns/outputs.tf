output "push_topic_arn" {
  description = "SNS push events topic ARN"
  value       = aws_sns_topic.push_events.arn
}

output "fcm_platform_application_arn" {
  description = "SNS FCM platform application ARN (empty if FCM key not provided)"
  value       = length(aws_sns_platform_application.fcm) > 0 ? aws_sns_platform_application.fcm[0].arn : ""
}
