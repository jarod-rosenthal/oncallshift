terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }

  # Uncomment for remote state
  # backend "s3" {
  #   bucket = "your-terraform-state-bucket"
  #   key    = "pagerduty-lite/dev/terraform.tfstate"
  #   region = "us-east-1"
  #   encrypt = true
  # }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}

# Data sources
data "aws_caller_identity" "current" {}
data "aws_availability_zones" "available" {
  state = "available"
}

locals {
  availability_zones = slice(data.aws_availability_zones.available.names, 0, var.az_count)
}

# Networking
module "networking" {
  source = "../../modules/networking"

  project_name       = var.project_name
  environment        = var.environment
  aws_region         = var.aws_region
  vpc_cidr           = var.vpc_cidr
  availability_zones = local.availability_zones

  # Cost optimization: Use VPC endpoints instead of NAT gateway
  enable_nat_gateway   = false
  enable_vpc_endpoints = true
}

# Database
module "database" {
  source = "../../modules/database"

  project_name       = var.project_name
  environment        = var.environment
  private_subnet_ids = module.networking.private_subnet_ids
  security_group_id  = module.networking.rds_security_group_id

  database_name              = var.database_name
  engine_version             = "15.4"
  min_capacity               = var.db_min_capacity
  max_capacity               = var.db_max_capacity
  backup_retention_period    = var.db_backup_retention_days
  enable_performance_insights = false
  enable_enhanced_monitoring = false
  create_reader_instance     = false
}

# Application Load Balancer
resource "aws_lb" "main" {
  name               = "${var.project_name}-${var.environment}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [module.networking.alb_security_group_id]
  subnets            = module.networking.public_subnet_ids

  enable_deletion_protection = var.environment == "prod" ? true : false
  enable_http2               = true

  tags = {
    Name = "${var.project_name}-${var.environment}-alb"
  }
}

# ALB Target Group for API
resource "aws_lb_target_group" "api" {
  name        = "${var.project_name}-${var.environment}-api-tg"
  port        = 3000
  protocol    = "HTTP"
  vpc_id      = module.networking.vpc_id
  target_type = "ip"

  health_check {
    enabled             = true
    path                = "/health"
    port                = "traffic-port"
    protocol            = "HTTP"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    timeout             = 5
    interval            = 30
    matcher             = "200"
  }

  deregistration_delay = 30

  tags = {
    Name = "${var.project_name}-${var.environment}-api-tg"
  }
}

# ALB Listener (HTTP) - redirect to HTTPS
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"
    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

# ALB Listener (HTTPS) - requires ACM certificate
# For MVP, you can comment this out and use HTTP only for testing
resource "aws_lb_listener" "https" {
  count = var.acm_certificate_arn != null ? 1 : 0

  load_balancer_arn = aws_lb.main.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = var.acm_certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }
}

# For MVP without SSL certificate, use HTTP listener for API
resource "aws_lb_listener_rule" "api_http" {
  count = var.acm_certificate_arn == null ? 1 : 0

  listener_arn = aws_lb_listener.http.arn

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }

  condition {
    path_pattern {
      values = ["/api/*", "/health"]
    }
  }
}

# SQS Queues
resource "aws_sqs_queue" "alerts_dlq" {
  name                      = "${var.project_name}-${var.environment}-alerts-dlq"
  message_retention_seconds = 1209600 # 14 days

  tags = {
    Name = "${var.project_name}-${var.environment}-alerts-dlq"
  }
}

resource "aws_sqs_queue" "alerts" {
  name                       = "${var.project_name}-${var.environment}-alerts"
  visibility_timeout_seconds = 60
  message_retention_seconds  = 345600 # 4 days
  receive_wait_time_seconds  = 10     # Long polling

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.alerts_dlq.arn
    maxReceiveCount     = 3
  })

  tags = {
    Name = "${var.project_name}-${var.environment}-alerts"
  }
}

resource "aws_sqs_queue" "notifications_dlq" {
  name                      = "${var.project_name}-${var.environment}-notifications-dlq"
  message_retention_seconds = 1209600

  tags = {
    Name = "${var.project_name}-${var.environment}-notifications-dlq"
  }
}

resource "aws_sqs_queue" "notifications" {
  name                       = "${var.project_name}-${var.environment}-notifications"
  visibility_timeout_seconds = 30
  message_retention_seconds  = 345600
  receive_wait_time_seconds  = 10

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.notifications_dlq.arn
    maxReceiveCount     = 3
  })

  tags = {
    Name = "${var.project_name}-${var.environment}-notifications"
  }
}

# SNS Topics for Push Notifications
resource "aws_sns_platform_application" "fcm" {
  count = var.fcm_server_key != null ? 1 : 0

  name     = "${var.project_name}-${var.environment}-fcm"
  platform = "GCM"

  platform_credential = var.fcm_server_key

  # Event endpoint for delivery status
  event_endpoint_created_topic_arn  = aws_sns_topic.push_events.arn
  event_endpoint_deleted_topic_arn  = aws_sns_topic.push_events.arn
  event_endpoint_updated_topic_arn  = aws_sns_topic.push_events.arn
  event_delivery_failure_topic_arn  = aws_sns_topic.push_events.arn
  event_delivery_success_topic_arn  = aws_sns_topic.push_events.arn
}

resource "aws_sns_platform_application" "apns" {
  count = var.apns_certificate != null ? 1 : 0

  name     = "${var.project_name}-${var.environment}-apns"
  platform = var.apns_use_sandbox ? "APNS_SANDBOX" : "APNS"

  platform_credential = var.apns_private_key
  platform_principal  = var.apns_certificate

  event_endpoint_created_topic_arn = aws_sns_topic.push_events.arn
  event_endpoint_deleted_topic_arn = aws_sns_topic.push_events.arn
  event_endpoint_updated_topic_arn = aws_sns_topic.push_events.arn
  event_delivery_failure_topic_arn = aws_sns_topic.push_events.arn
  event_delivery_success_topic_arn = aws_sns_topic.push_events.arn
}

resource "aws_sns_topic" "push_events" {
  name = "${var.project_name}-${var.environment}-push-events"

  tags = {
    Name = "${var.project_name}-${var.environment}-push-events"
  }
}

# Cognito User Pool
resource "aws_cognito_user_pool" "main" {
  name = "${var.project_name}-${var.environment}"

  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  password_policy {
    minimum_length    = 8
    require_lowercase = true
    require_numbers   = true
    require_symbols   = true
    require_uppercase = true
  }

  schema {
    name                = "email"
    attribute_data_type = "String"
    required            = true
    mutable             = true
  }

  schema {
    name                = "org_id"
    attribute_data_type = "String"
    mutable             = true
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-user-pool"
  }
}

resource "aws_cognito_user_pool_client" "mobile" {
  name         = "${var.project_name}-${var.environment}-mobile"
  user_pool_id = aws_cognito_user_pool.main.id

  generate_secret = false

  explicit_auth_flows = [
    "ALLOW_USER_SRP_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
    "ALLOW_USER_PASSWORD_AUTH"
  ]

  refresh_token_validity = 30
  access_token_validity  = 1
  id_token_validity      = 1

  token_validity_units {
    refresh_token = "days"
    access_token  = "hours"
    id_token      = "hours"
  }
}

# ECS Cluster (shared by API and workers)
resource "aws_ecs_cluster" "main" {
  name = "${var.project_name}-${var.environment}"

  setting {
    name  = "containerInsights"
    value = var.enable_container_insights ? "enabled" : "disabled"
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-cluster"
  }
}

# API Service
module "api_service" {
  source = "../../modules/ecs-service"

  project_name       = var.project_name
  environment        = var.environment
  aws_region         = var.aws_region
  service_name       = "api"
  ecs_cluster_id     = aws_ecs_cluster.main.id
  private_subnet_ids = module.networking.private_subnet_ids
  security_group_id  = module.networking.ecs_security_group_id

  task_cpu    = "512"
  task_memory = "1024"

  desired_count = var.api_desired_count
  container_port = 3000

  target_group_arn  = aws_lb_target_group.api.arn
  alb_listener_arn  = var.acm_certificate_arn != null ? aws_lb_listener.https[0].arn : aws_lb_listener.http.arn

  environment_variables = {
    NODE_ENV = var.environment
    PORT     = "3000"
    AWS_REGION = var.aws_region
    ALERTS_QUEUE_URL = aws_sqs_queue.alerts.url
    NOTIFICATIONS_QUEUE_URL = aws_sqs_queue.notifications.url
    FCM_PLATFORM_APP_ARN = var.fcm_server_key != null ? aws_sns_platform_application.fcm[0].arn : ""
    APNS_PLATFORM_APP_ARN = var.apns_certificate != null ? aws_sns_platform_application.apns[0].arn : ""
  }

  secrets = {
    DATABASE_URL = module.database.secret_arn
  }

  secrets_arns = [module.database.secret_arn]

  sqs_queue_arns = [
    aws_sqs_queue.alerts.arn,
    aws_sqs_queue.notifications.arn
  ]

  sns_topic_arns = [
    aws_sns_topic.push_events.arn
  ]

  enable_autoscaling        = true
  autoscaling_min_capacity  = 1
  autoscaling_max_capacity  = 4
  autoscaling_cpu_target    = 70
  autoscaling_memory_target = 80

  log_retention_days = var.log_retention_days
}

# Notification Worker Service
module "notification_worker" {
  source = "../../modules/ecs-service"

  project_name       = var.project_name
  environment        = var.environment
  aws_region         = var.aws_region
  service_name       = "notification-worker"
  ecs_cluster_id     = aws_ecs_cluster.main.id
  private_subnet_ids = module.networking.private_subnet_ids
  security_group_id  = module.networking.ecs_security_group_id

  task_cpu    = "256"
  task_memory = "512"

  desired_count = var.worker_desired_count
  container_port = null # Worker service, no HTTP port

  environment_variables = {
    NODE_ENV = var.environment
    AWS_REGION = var.aws_region
    NOTIFICATIONS_QUEUE_URL = aws_sqs_queue.notifications.url
    FCM_PLATFORM_APP_ARN = var.fcm_server_key != null ? aws_sns_platform_application.fcm[0].arn : ""
    APNS_PLATFORM_APP_ARN = var.apns_certificate != null ? aws_sns_platform_application.apns[0].arn : ""
  }

  secrets = {
    DATABASE_URL = module.database.secret_arn
  }

  secrets_arns = [module.database.secret_arn]

  sqs_queue_arns = [
    aws_sqs_queue.notifications.arn
  ]

  sns_topic_arns = [
    aws_sns_topic.push_events.arn
  ]

  additional_task_policy_statements = [
    {
      Effect = "Allow"
      Action = [
        "sns:CreatePlatformEndpoint",
        "sns:Publish",
        "sns:GetEndpointAttributes",
        "sns:SetEndpointAttributes",
        "sns:DeleteEndpoint"
      ]
      Resource = "*"
    }
  ]

  log_retention_days = var.log_retention_days
}
