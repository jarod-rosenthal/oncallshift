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

  backend "s3" {
    bucket  = "oncallshift"
    key     = "terraform/dev/terraform.tfstate"
    region  = "us-east-1"
    encrypt = true
  }
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

  # Enable NAT gateway for Cognito API access (Cognito doesn't support VPC endpoints)
  enable_nat_gateway   = true
  enable_vpc_endpoints = true
}

# Database
module "database" {
  source = "../../modules/database"

  project_name       = var.project_name
  environment        = var.environment
  private_subnet_ids = module.networking.private_subnet_ids
  security_group_id  = module.networking.rds_security_group_id

  database_name               = var.database_name
  engine_version              = "15.15"
  instance_class              = var.db_instance_class
  allocated_storage           = var.db_allocated_storage
  max_allocated_storage       = var.db_max_allocated_storage
  backup_retention_period     = var.db_backup_retention_days
  enable_performance_insights = false
  enable_enhanced_monitoring  = false
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
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }
}

# ALB Listener (HTTPS) - requires ACM certificate
# For MVP, you can comment this out and use HTTP only for testing
resource "aws_lb_listener" "https" {
  count = var.domain_name != null ? 1 : 0

  load_balancer_arn = aws_lb.main.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = aws_acm_certificate_validation.main[0].certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }

  depends_on = [aws_acm_certificate_validation.main]

  lifecycle {
    prevent_destroy = true
  }
}

# For MVP without SSL certificate, use HTTP listener for API
resource "aws_lb_listener_rule" "api_http" {
  count = var.domain_name == null ? 1 : 0

  listener_arn = aws_lb_listener.http.arn

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }

  condition {
    path_pattern {
      values = ["/", "/api/*", "/health", "/demo", "/api-docs*"]
    }
  }
}

# Route53 and ACM for custom domain
data "aws_route53_zone" "main" {
  count = var.domain_name != null ? 1 : 0

  name         = var.domain_name
  private_zone = false
}

# ACM Certificate for HTTPS
resource "aws_acm_certificate" "main" {
  count = var.domain_name != null ? 1 : 0

  domain_name       = var.domain_name
  validation_method = "DNS"

  subject_alternative_names = [
    "*.${var.domain_name}"
  ]

  lifecycle {
    create_before_destroy = true
    prevent_destroy       = true
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-cert"
  }
}

# Route53 record for ACM validation
resource "aws_route53_record" "cert_validation" {
  for_each = var.domain_name != null ? {
    for dvo in aws_acm_certificate.main[0].domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  } : {}

  allow_overwrite = true
  name            = each.value.name
  records         = [each.value.record]
  ttl             = 60
  type            = each.value.type
  zone_id         = data.aws_route53_zone.main[0].zone_id
}

# Wait for ACM certificate validation
resource "aws_acm_certificate_validation" "main" {
  count = var.domain_name != null ? 1 : 0

  certificate_arn         = aws_acm_certificate.main[0].arn
  validation_record_fqdns = [for record in aws_route53_record.cert_validation : record.fqdn]
}

# Route53 A record pointing to CloudFront
resource "aws_route53_record" "main" {
  count = var.domain_name != null ? 1 : 0

  zone_id = data.aws_route53_zone.main[0].zone_id
  name    = var.domain_name
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.main[0].domain_name
    zone_id                = aws_cloudfront_distribution.main[0].hosted_zone_id
    evaluate_target_health = false
  }

  lifecycle {
    prevent_destroy = true
  }
}

# Route53 wildcard A record for subdomains
resource "aws_route53_record" "wildcard" {
  count = var.domain_name != null ? 1 : 0

  zone_id = data.aws_route53_zone.main[0].zone_id
  name    = "*.${var.domain_name}"
  type    = "A"

  alias {
    name                   = aws_lb.main.dns_name
    zone_id                = aws_lb.main.zone_id
    evaluate_target_health = true
  }

  lifecycle {
    prevent_destroy = true
  }
}

# ProtonMail TXT records (verification and SPF)
resource "aws_route53_record" "protonmail_txt" {
  count = var.domain_name != null ? 1 : 0

  zone_id = data.aws_route53_zone.main[0].zone_id
  name    = var.domain_name
  type    = "TXT"
  ttl     = 3600
  records = [
    "protonmail-verification=fc93d89c63116acd6455ebdb1bc45cd47f9e4d6b",
    "v=spf1 include:_spf.protonmail.ch ~all"
  ]
}

# ProtonMail MX records
resource "aws_route53_record" "protonmail_mx" {
  count = var.domain_name != null ? 1 : 0

  zone_id = data.aws_route53_zone.main[0].zone_id
  name    = var.domain_name
  type    = "MX"
  ttl     = 3600
  records = [
    "10 mail.protonmail.ch",
    "20 mailsec.protonmail.ch"
  ]
}

# ProtonMail DKIM CNAME records
resource "aws_route53_record" "protonmail_dkim" {
  count = var.domain_name != null ? 1 : 0

  zone_id = data.aws_route53_zone.main[0].zone_id
  name    = "protonmail._domainkey.${var.domain_name}"
  type    = "CNAME"
  ttl     = 3600
  records = ["protonmail.domainkey.dypowykbuzkuqq5u3skixytgcwuv4zo4b5ptyc4f7ti6kofmn5ysa.domains.proton.ch."]
}

resource "aws_route53_record" "protonmail_dkim2" {
  count = var.domain_name != null ? 1 : 0

  zone_id = data.aws_route53_zone.main[0].zone_id
  name    = "protonmail2._domainkey.${var.domain_name}"
  type    = "CNAME"
  ttl     = 3600
  records = ["protonmail2.domainkey.dypowykbuzkuqq5u3skixytgcwuv4zo4b5ptyc4f7ti6kofmn5ysa.domains.proton.ch."]
}

resource "aws_route53_record" "protonmail_dkim3" {
  count = var.domain_name != null ? 1 : 0

  zone_id = data.aws_route53_zone.main[0].zone_id
  name    = "protonmail3._domainkey.${var.domain_name}"
  type    = "CNAME"
  ttl     = 3600
  records = ["protonmail3.domainkey.dypowykbuzkuqq5u3skixytgcwuv4zo4b5ptyc4f7ti6kofmn5ysa.domains.proton.ch."]
}

# ProtonMail DMARC TXT record
resource "aws_route53_record" "protonmail_dmarc" {
  count = var.domain_name != null ? 1 : 0

  zone_id = data.aws_route53_zone.main[0].zone_id
  name    = "_dmarc.${var.domain_name}"
  type    = "TXT"
  ttl     = 3600
  records = ["v=DMARC1; p=quarantine"]
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

  lifecycle {
    ignore_changes = [schema]
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

# ECS Cluster Capacity Providers
resource "aws_ecs_cluster_capacity_providers" "main" {
  cluster_name = aws_ecs_cluster.main.name

  capacity_providers = ["FARGATE", "FARGATE_SPOT"]

  default_capacity_provider_strategy {
    capacity_provider = var.use_fargate_spot ? "FARGATE_SPOT" : "FARGATE"
    weight            = 1
    base              = 1
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
  alb_listener_arn  = var.domain_name != null ? aws_lb_listener.https[0].arn : aws_lb_listener.http.arn

  environment_variables = {
    NODE_ENV = var.environment
    PORT     = "3000"
    AWS_REGION = var.aws_region
    ALERTS_QUEUE_URL = aws_sqs_queue.alerts.url
    NOTIFICATIONS_QUEUE_URL = aws_sqs_queue.notifications.url
    FCM_PLATFORM_APP_ARN = var.fcm_server_key != null ? aws_sns_platform_application.fcm[0].arn : ""
    APNS_PLATFORM_APP_ARN = var.apns_certificate != null ? aws_sns_platform_application.apns[0].arn : ""
    COGNITO_USER_POOL_ID = aws_cognito_user_pool.main.id
    COGNITO_CLIENT_ID = aws_cognito_user_pool_client.mobile.id
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

  additional_task_policy_statements = [
    {
      Effect = "Allow"
      Action = [
        "cognito-idp:AdminConfirmSignUp",
        "cognito-idp:AdminCreateUser",
        "cognito-idp:AdminSetUserPassword",
        "cognito-idp:AdminUpdateUserAttributes"
      ]
      Resource = aws_cognito_user_pool.main.arn
    }
  ]

  enable_autoscaling        = true
  autoscaling_min_capacity  = 1
  autoscaling_max_capacity  = 4
  autoscaling_cpu_target    = 70
  autoscaling_memory_target = 80

  use_fargate_spot         = var.use_fargate_spot
  fargate_spot_percentage  = var.fargate_spot_percentage

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
    SES_FROM_EMAIL = "noreply@oncallshift.com"
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

  use_fargate_spot         = var.use_fargate_spot
  fargate_spot_percentage  = var.fargate_spot_percentage

  log_retention_days = var.log_retention_days
}

# Alert Processor Worker Service
module "alert_processor" {
  source = "../../modules/ecs-service"

  project_name       = var.project_name
  environment        = var.environment
  aws_region         = var.aws_region
  service_name       = "alert-processor"
  ecs_cluster_id     = aws_ecs_cluster.main.id
  private_subnet_ids = module.networking.private_subnet_ids
  security_group_id  = module.networking.ecs_security_group_id

  task_cpu    = "256"
  task_memory = "512"

  desired_count = var.worker_desired_count
  container_port = null # Worker service, no HTTP port

  # Override Docker CMD to run alert processor instead of notification worker
  command = ["node", "dist/workers/alert-processor.js"]

  environment_variables = {
    NODE_ENV = var.environment
    AWS_REGION = var.aws_region
    ALERTS_QUEUE_URL = aws_sqs_queue.alerts.url
    NOTIFICATIONS_QUEUE_URL = aws_sqs_queue.notifications.url
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

  use_fargate_spot         = var.use_fargate_spot
  fargate_spot_percentage  = var.fargate_spot_percentage

  log_retention_days = var.log_retention_days
}

# Escalation Timer Worker Service
module "escalation_timer" {
  source = "../../modules/ecs-service"

  project_name       = var.project_name
  environment        = var.environment
  aws_region         = var.aws_region
  service_name       = "escalation-timer"
  ecs_cluster_id     = aws_ecs_cluster.main.id
  private_subnet_ids = module.networking.private_subnet_ids
  security_group_id  = module.networking.ecs_security_group_id

  task_cpu    = "256"
  task_memory = "512"

  desired_count = 1  # Only one instance needed - this is a timer/cron-style worker
  container_port = null # Worker service, no HTTP port

  # Override Docker CMD to run escalation timer
  command = ["node", "dist/workers/escalation-timer.js"]

  environment_variables = {
    NODE_ENV = var.environment
    AWS_REGION = var.aws_region
    NOTIFICATIONS_QUEUE_URL = aws_sqs_queue.notifications.url
    ESCALATION_CHECK_INTERVAL_MS = "30000"  # Check every 30 seconds
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

  use_fargate_spot         = var.use_fargate_spot
  fargate_spot_percentage  = var.fargate_spot_percentage

  log_retention_days = var.log_retention_days
}

# S3 bucket for static files (CloudFront only access)
resource "aws_s3_bucket" "web" {
  bucket = "${var.project_name}-${var.environment}-web"

  tags = {
    Name = "${var.project_name}-${var.environment}-web"
  }
}

# Block ALL public access - CloudFront OAC will handle access
resource "aws_s3_bucket_public_access_block" "web" {
  bucket = aws_s3_bucket.web.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# S3 bucket policy - ONLY allow CloudFront OAC
resource "aws_s3_bucket_policy" "web" {
  count = var.domain_name != null ? 1 : 0

  bucket = aws_s3_bucket.web.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowCloudFrontOAC"
        Effect    = "Allow"
        Principal = {
          Service = "cloudfront.amazonaws.com"
        }
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.web.arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.main[0].arn
          }
        }
      }
    ]
  })

  depends_on = [aws_s3_bucket_public_access_block.web]
}

# CloudFront Origin Access Control for S3
resource "aws_cloudfront_origin_access_control" "s3" {
  count = var.domain_name != null ? 1 : 0

  name                              = "${var.project_name}-${var.environment}-s3-oac"
  description                       = "OAC for S3 static website"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# CloudFront Distribution
resource "aws_cloudfront_distribution" "main" {
  count = var.domain_name != null ? 1 : 0

  enabled             = true
  is_ipv6_enabled     = true
  comment             = "${var.project_name}-${var.environment}"
  default_root_object = "index.html"
  price_class         = "PriceClass_100"  # Use only North America and Europe (lowest cost)
  aliases             = [var.domain_name]

  # S3 origin for static content
  origin {
    domain_name              = aws_s3_bucket.web.bucket_regional_domain_name
    origin_id                = "S3-${aws_s3_bucket.web.id}"
    origin_access_control_id = aws_cloudfront_origin_access_control.s3[0].id
  }

  # ALB origin for API
  origin {
    domain_name = aws_lb.main.dns_name
    origin_id   = "ALB-${var.project_name}-${var.environment}"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "http-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  # Default behavior - serve from ALB (Express serves React SPA)
  default_cache_behavior {
    allowed_methods  = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "ALB-${var.project_name}-${var.environment}"

    forwarded_values {
      query_string = true
      headers      = ["Authorization", "Content-Type", "Origin", "Accept", "Host"]
      cookies {
        forward = "all"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 0  # Don't cache HTML pages (SPA routing)
    max_ttl                = 0
    compress               = true
  }

  # Static assets behavior - cache JS, CSS, images from ALB
  ordered_cache_behavior {
    path_pattern     = "/assets/*"
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "ALB-${var.project_name}-${var.environment}"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 86400  # Cache for 24 hours
    max_ttl                = 31536000  # Max 1 year
    compress               = true
  }

  # API behavior - forward to ALB
  ordered_cache_behavior {
    path_pattern     = "/api/*"
    allowed_methods  = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "ALB-${var.project_name}-${var.environment}"

    forwarded_values {
      query_string = true
      headers      = ["Authorization", "Content-Type", "Origin", "Accept"]
      cookies {
        forward = "all"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 0
    max_ttl                = 0
    compress               = false
  }

  # Health check behavior
  ordered_cache_behavior {
    path_pattern     = "/health"
    allowed_methods  = ["GET", "HEAD"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "ALB-${var.project_name}-${var.environment}"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 0
    max_ttl                = 0
  }

  # Demo page behavior
  ordered_cache_behavior {
    path_pattern     = "/demo"
    allowed_methods  = ["GET", "HEAD"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "ALB-${var.project_name}-${var.environment}"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 0
    max_ttl                = 0
  }

  # Login page behavior - forward to backend
  ordered_cache_behavior {
    path_pattern     = "/login"
    allowed_methods  = ["GET", "HEAD"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "ALB-${var.project_name}-${var.environment}"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 0
    max_ttl                = 0
  }

  # API docs behavior
  ordered_cache_behavior {
    path_pattern     = "/api-docs*"
    allowed_methods  = ["GET", "HEAD"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "ALB-${var.project_name}-${var.environment}"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 0
    max_ttl                = 0
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate_validation.main[0].certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-cdn"
  }
}

