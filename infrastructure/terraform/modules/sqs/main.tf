# Dead letter queues
resource "aws_sqs_queue" "alerts_dlq" {
  name                      = "${var.project}-${var.environment}-alerts-dlq"
  message_retention_seconds = 1209600 # 14 days

  tags = var.tags
}

resource "aws_sqs_queue" "notifications_dlq" {
  name                      = "${var.project}-${var.environment}-notifications-dlq"
  message_retention_seconds = 1209600 # 14 days

  tags = var.tags
}

# Main queues
resource "aws_sqs_queue" "alerts" {
  name                       = "${var.project}-${var.environment}-alerts"
  visibility_timeout_seconds = 30
  message_retention_seconds  = 345600 # 4 days
  receive_wait_time_seconds  = 20     # Long polling

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.alerts_dlq.arn
    maxReceiveCount     = 3
  })

  tags = var.tags
}

resource "aws_sqs_queue" "notifications" {
  name                       = "${var.project}-${var.environment}-notifications"
  visibility_timeout_seconds = 30
  message_retention_seconds  = 345600 # 4 days
  receive_wait_time_seconds  = 20     # Long polling

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.notifications_dlq.arn
    maxReceiveCount     = 3
  })

  tags = var.tags
}

# Redrive allow policies — let main queues use DLQs
resource "aws_sqs_queue_redrive_allow_policy" "alerts_dlq" {
  queue_url = aws_sqs_queue.alerts_dlq.id

  redrive_allow_policy = jsonencode({
    redrivePermission = "byQueue"
    sourceQueueArns   = [aws_sqs_queue.alerts.arn]
  })
}

resource "aws_sqs_queue_redrive_allow_policy" "notifications_dlq" {
  queue_url = aws_sqs_queue.notifications_dlq.id

  redrive_allow_policy = jsonencode({
    redrivePermission = "byQueue"
    sourceQueueArns   = [aws_sqs_queue.notifications.arn]
  })
}
