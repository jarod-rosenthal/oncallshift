terraform {
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
}

# Random password for database
resource "random_password" "master_password" {
  length  = 32
  special = true
  # Exclude characters that RDS doesn't allow: /, @, ", and space
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

# Store password in Secrets Manager
resource "aws_secretsmanager_secret" "db_master_password" {
  name_prefix             = "${var.project_name}-${var.environment}-db-password-"
  recovery_window_in_days = var.environment == "prod" ? 7 : 0

  tags = {
    Name        = "${var.project_name}-${var.environment}-db-password"
    Environment = var.environment
  }
}

resource "aws_secretsmanager_secret_version" "db_master_password" {
  secret_id = aws_secretsmanager_secret.db_master_password.id
  secret_string = jsonencode({
    username = var.master_username
    password = random_password.master_password.result
    engine   = "postgres"
    host     = var.enable_rds_proxy ? aws_db_proxy.main[0].endpoint : aws_db_instance.main.address
    port     = 5432
    dbname   = var.database_name
  })

  # Ensure proxy is created before updating the secret with proxy endpoint
  depends_on = [
    aws_db_proxy.main,
    aws_db_proxy_target.main
  ]
}

# DB Subnet Group
resource "aws_db_subnet_group" "main" {
  name_prefix = "${var.project_name}-${var.environment}-"
  subnet_ids  = var.private_subnet_ids

  tags = {
    Name        = "${var.project_name}-${var.environment}-db-subnet-group"
    Environment = var.environment
  }
}

# RDS PostgreSQL Instance
resource "aws_db_instance" "main" {
  identifier     = "${var.project_name}-${var.environment}"
  engine         = "postgres"
  engine_version = var.engine_version
  instance_class = var.instance_class

  # Database configuration
  db_name  = var.database_name
  username = var.master_username
  password = random_password.master_password.result
  port     = 5432

  # Storage configuration
  allocated_storage     = var.allocated_storage
  max_allocated_storage = var.max_allocated_storage
  storage_type          = "gp3"
  storage_encrypted     = true
  kms_key_id            = var.kms_key_arn

  # Network configuration
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [var.security_group_id]
  publicly_accessible    = false

  # Backup configuration
  backup_retention_period      = var.backup_retention_period
  backup_window                = var.preferred_backup_window
  maintenance_window           = var.preferred_maintenance_window
  copy_tags_to_snapshot        = true
  skip_final_snapshot          = var.environment != "prod"
  final_snapshot_identifier    = var.environment == "prod" ? "${var.project_name}-${var.environment}-final-snapshot-${formatdate("YYYY-MM-DD-hhmm", timestamp())}" : null
  deletion_protection          = var.deletion_protection

  # Performance Insights
  performance_insights_enabled          = var.enable_performance_insights
  performance_insights_retention_period = var.enable_performance_insights ? 7 : null

  # Enhanced Monitoring
  monitoring_interval = var.enable_enhanced_monitoring ? 60 : 0
  monitoring_role_arn = var.enable_enhanced_monitoring ? aws_iam_role.rds_monitoring[0].arn : null

  # Logging
  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]

  # Performance
  auto_minor_version_upgrade = true

  tags = {
    Name        = "${var.project_name}-${var.environment}-postgres"
    Environment = var.environment
  }

  lifecycle {
    # Temporarily ignoring vpc_security_group_ids due to AWS stuck state
    # where sg-042379676eeb8f86c (deleted) is stuck in "adding" status
    # TODO: Remove vpc_security_group_ids from ignore list once AWS clears the stuck state
    ignore_changes = [final_snapshot_identifier, vpc_security_group_ids]
  }
}

# IAM Role for Enhanced Monitoring
resource "aws_iam_role" "rds_monitoring" {
  count = var.enable_enhanced_monitoring ? 1 : 0

  name_prefix = "${var.project_name}-${var.environment}-rds-mon-"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "monitoring.rds.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name        = "${var.project_name}-${var.environment}-rds-monitoring-role"
    Environment = var.environment
  }
}

resource "aws_iam_role_policy_attachment" "rds_monitoring" {
  count = var.enable_enhanced_monitoring ? 1 : 0

  role       = aws_iam_role.rds_monitoring[0].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}

# CloudWatch Alarms
resource "aws_cloudwatch_metric_alarm" "database_cpu" {
  count = var.create_cloudwatch_alarms ? 1 : 0

  alarm_name          = "${var.project_name}-${var.environment}-postgres-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "Alert when RDS CPU exceeds 80%"
  alarm_actions       = var.alarm_sns_topic_arn != null ? [var.alarm_sns_topic_arn] : []

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.main.id
  }

  tags = {
    Name        = "${var.project_name}-${var.environment}-postgres-cpu-alarm"
    Environment = var.environment
  }
}

resource "aws_cloudwatch_metric_alarm" "database_connections" {
  count = var.create_cloudwatch_alarms ? 1 : 0

  alarm_name          = "${var.project_name}-${var.environment}-postgres-connections-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "DatabaseConnections"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 50
  alarm_description   = "Alert when RDS connections exceed 50"
  alarm_actions       = var.alarm_sns_topic_arn != null ? [var.alarm_sns_topic_arn] : []

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.main.id
  }

  tags = {
    Name        = "${var.project_name}-${var.environment}-postgres-connections-alarm"
    Environment = var.environment
  }
}

# =============================================================================
# RDS Proxy for Connection Pooling
# =============================================================================

# IAM Role for RDS Proxy
resource "aws_iam_role" "rds_proxy" {
  count = var.enable_rds_proxy ? 1 : 0

  name_prefix = "${var.project_name}-${var.environment}-rds-proxy-"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "rds.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name        = "${var.project_name}-${var.environment}-rds-proxy-role"
    Environment = var.environment
  }
}

# IAM Policy for RDS Proxy to access Secrets Manager
resource "aws_iam_role_policy" "rds_proxy_secrets" {
  count = var.enable_rds_proxy ? 1 : 0

  name_prefix = "${var.project_name}-${var.environment}-rds-proxy-secrets-"
  role        = aws_iam_role.rds_proxy[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetResourcePolicy",
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret",
          "secretsmanager:ListSecretVersionIds"
        ]
        Resource = aws_secretsmanager_secret.db_master_password.arn
      }
    ]
  })
}

# RDS Proxy
resource "aws_db_proxy" "main" {
  count = var.enable_rds_proxy ? 1 : 0

  name                   = "${var.project_name}-${var.environment}-proxy"
  engine_family          = "POSTGRESQL"
  auth {
    auth_scheme = "SECRETS"
    iam_auth    = "DISABLED"
    secret_arn  = aws_secretsmanager_secret.db_master_password.arn
  }

  role_arn               = aws_iam_role.rds_proxy[0].arn
  vpc_subnet_ids         = var.private_subnet_ids
  require_tls            = true

  # Enhanced logging to CloudWatch
  debug_logging = var.enable_proxy_debug_logging

  tags = {
    Name        = "${var.project_name}-${var.environment}-rds-proxy"
    Environment = var.environment
  }

  # Wait for the IAM policy to be attached before creating the proxy
  depends_on = [aws_iam_role_policy.rds_proxy_secrets]
}

# RDS Proxy Target Group
resource "aws_db_proxy_default_target_group" "main" {
  count = var.enable_rds_proxy ? 1 : 0

  db_proxy_name = aws_db_proxy.main[0].name

  connection_pool_config {
    # Max percentage of available connections to use (for db.t4g.micro with ~100 connections)
    # Setting to 90% allows ~90 pooled connections with buffer for admin/maintenance
    max_connections_percent        = 90

    # Max percentage of connections that can be borrowed (idle connections)
    max_idle_connections_percent   = 50

    # Timeout for borrowed connections (5 minutes)
    connection_borrow_timeout      = 300

    # SQL statements to run on each new connection
    init_query                     = ""

    # Session pinning filters - empty means no pinning (more efficient connection reuse)
    session_pinning_filters        = []
  }
}

# RDS Proxy Target
resource "aws_db_proxy_target" "main" {
  count = var.enable_rds_proxy ? 1 : 0

  db_proxy_name         = aws_db_proxy.main[0].name
  target_group_name     = aws_db_proxy_default_target_group.main[0].name
  db_instance_identifier = aws_db_instance.main.id
}

# CloudWatch Log Group for RDS Proxy
resource "aws_cloudwatch_log_group" "rds_proxy" {
  count = var.enable_rds_proxy && var.enable_proxy_debug_logging ? 1 : 0

  name              = "/aws/rds/proxy/${var.project_name}-${var.environment}"
  retention_in_days = 7

  tags = {
    Name        = "${var.project_name}-${var.environment}-rds-proxy-logs"
    Environment = var.environment
  }
}
