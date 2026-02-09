# Push events topic — used to fan out push notifications
resource "aws_sns_topic" "push_events" {
  name = "${var.project}-${var.environment}-push-events"

  tags = var.tags
}

# FCM platform application for Android push notifications
resource "aws_sns_platform_application" "fcm" {
  count = var.fcm_api_key != "" ? 1 : 0

  name                = "${var.project}-${var.environment}-fcm"
  platform            = "GCM"
  platform_credential = var.fcm_api_key
}
