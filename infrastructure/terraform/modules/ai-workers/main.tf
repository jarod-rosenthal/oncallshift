terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

data "aws_caller_identity" "current" {}

locals {
  name_prefix = "${var.project_name}-${var.environment}"
}

# =============================================================================
# SQS Queue for AI Worker Tasks
# =============================================================================

resource "aws_sqs_queue" "ai_worker_tasks" {
  name                       = "${local.name_prefix}-ai-worker-tasks"
  delay_seconds              = 0
  max_message_size           = 262144  # 256 KB
  message_retention_seconds  = 86400   # 1 day
  receive_wait_time_seconds  = 20      # Long polling
  visibility_timeout_seconds = 3600    # 1 hour (max task execution time)

  # Enable dead letter queue
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.ai_worker_tasks_dlq.arn
    maxReceiveCount     = 3
  })

  tags = {
    Name        = "${local.name_prefix}-ai-worker-tasks"
    Environment = var.environment
    Component   = "ai-workers"
  }
}

resource "aws_sqs_queue" "ai_worker_tasks_dlq" {
  name                      = "${local.name_prefix}-ai-worker-tasks-dlq"
  message_retention_seconds = 1209600  # 14 days

  tags = {
    Name        = "${local.name_prefix}-ai-worker-tasks-dlq"
    Environment = var.environment
    Component   = "ai-workers"
  }
}

# =============================================================================
# ECR Repository for AI Worker Executor Image
# =============================================================================

resource "aws_ecr_repository" "ai_worker" {
  name                 = "${local.name_prefix}-ai-worker"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "AES256"
  }

  tags = {
    Name        = "${local.name_prefix}-ai-worker"
    Environment = var.environment
    Component   = "ai-workers"
  }
}

resource "aws_ecr_lifecycle_policy" "ai_worker" {
  repository = aws_ecr_repository.ai_worker.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep last 5 images"
        selection = {
          tagStatus     = "tagged"
          tagPrefixList = ["v", "latest"]
          countType     = "imageCountMoreThan"
          countNumber   = 5
        }
        action = {
          type = "expire"
        }
      },
      {
        rulePriority = 2
        description  = "Delete untagged images older than 7 days"
        selection = {
          tagStatus   = "untagged"
          countType   = "sinceImagePushed"
          countUnit   = "days"
          countNumber = 7
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}

# =============================================================================
# CloudWatch Log Groups
# =============================================================================

resource "aws_cloudwatch_log_group" "orchestrator" {
  name              = "/ecs/${local.name_prefix}/ai-worker-orchestrator"
  retention_in_days = var.log_retention_days

  tags = {
    Name        = "${local.name_prefix}-ai-worker-orchestrator-logs"
    Environment = var.environment
    Component   = "ai-workers"
  }
}

resource "aws_cloudwatch_log_group" "executor" {
  name              = "/ecs/${local.name_prefix}/ai-worker-executor"
  retention_in_days = var.log_retention_days

  tags = {
    Name        = "${local.name_prefix}-ai-worker-executor-logs"
    Environment = var.environment
    Component   = "ai-workers"
  }
}

# =============================================================================
# IAM Role for AI Worker Orchestrator (ECS Service)
# =============================================================================

resource "aws_iam_role" "orchestrator_execution_role" {
  name_prefix = "${local.name_prefix}-aiw-orch-ex-"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name        = "${local.name_prefix}-ai-worker-orchestrator-execution-role"
    Environment = var.environment
    Component   = "ai-workers"
  }
}

resource "aws_iam_role_policy_attachment" "orchestrator_execution_role_policy" {
  role       = aws_iam_role.orchestrator_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy" "orchestrator_execution_secrets" {
  name_prefix = "${local.name_prefix}-aiw-orch-secrets-"
  role        = aws_iam_role.orchestrator_execution_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret"
        ]
        Resource = var.secrets_arns
      }
    ]
  })
}

resource "aws_iam_role" "orchestrator_task_role" {
  name_prefix = "${local.name_prefix}-aiw-orch-task-"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name        = "${local.name_prefix}-ai-worker-orchestrator-task-role"
    Environment = var.environment
    Component   = "ai-workers"
  }
}

resource "aws_iam_role_policy" "orchestrator_task_policy" {
  name_prefix = "${local.name_prefix}-aiw-orch-task-"
  role        = aws_iam_role.orchestrator_task_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      # SQS access for task queue
      {
        Effect = "Allow"
        Action = [
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes",
          "sqs:ChangeMessageVisibility"
        ]
        Resource = aws_sqs_queue.ai_worker_tasks.arn
      },
      # ECS RunTask for spawning executor tasks
      {
        Effect = "Allow"
        Action = [
          "ecs:RunTask",
          "ecs:StopTask",
          "ecs:DescribeTasks",
          "ecs:TagResource"
        ]
        Resource = [
          "arn:aws:ecs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:task-definition/${local.name_prefix}-ai-worker-executor:*",
          "arn:aws:ecs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:task/${var.ecs_cluster_name}/*"
        ]
      },
      # IAM PassRole for task execution
      {
        Effect = "Allow"
        Action = "iam:PassRole"
        Resource = [
          aws_iam_role.executor_execution_role.arn,
          aws_iam_role.executor_task_role.arn
        ]
      },
      # CloudWatch Logs for streaming task output
      {
        Effect = "Allow"
        Action = [
          "logs:GetLogEvents",
          "logs:FilterLogEvents"
        ]
        Resource = "${aws_cloudwatch_log_group.executor.arn}:*"
      },
      # Secrets Manager for API keys
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = var.secrets_arns
      }
    ]
  })
}

# =============================================================================
# IAM Role for AI Worker Executor (Ephemeral Tasks)
# =============================================================================

resource "aws_iam_role" "executor_execution_role" {
  name_prefix = "${local.name_prefix}-aiw-exec-ex-"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name        = "${local.name_prefix}-ai-worker-executor-execution-role"
    Environment = var.environment
    Component   = "ai-workers"
  }
}

resource "aws_iam_role_policy_attachment" "executor_execution_role_policy" {
  role       = aws_iam_role.executor_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy" "executor_execution_secrets" {
  name_prefix = "${local.name_prefix}-aiw-exec-secrets-"
  role        = aws_iam_role.executor_execution_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret"
        ]
        Resource = var.secrets_arns
      }
    ]
  })
}

resource "aws_iam_role" "executor_task_role" {
  name_prefix = "${local.name_prefix}-aiw-exec-task-"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name        = "${local.name_prefix}-ai-worker-executor-task-role"
    Environment = var.environment
    Component   = "ai-workers"
  }
}

resource "aws_iam_role_policy" "executor_task_policy" {
  name_prefix = "${local.name_prefix}-aiw-exec-task-"
  role        = aws_iam_role.executor_task_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      # Secrets Manager for GitHub PAT, Anthropic API key
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = var.secrets_arns
      }
    ]
  })
}

# =============================================================================
# ECS Task Definition - AI Worker Executor (Ephemeral)
# =============================================================================

resource "aws_ecs_task_definition" "executor" {
  family                   = "${local.name_prefix}-ai-worker-executor"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.executor_cpu
  memory                   = var.executor_memory
  execution_role_arn       = aws_iam_role.executor_execution_role.arn
  task_role_arn            = aws_iam_role.executor_task_role.arn

  container_definitions = jsonencode([
    {
      name      = "ai-worker-executor"
      image     = "${aws_ecr_repository.ai_worker.repository_url}:v5"
      essential = true

      environment = [
        { name = "NODE_ENV", value = var.environment },
        { name = "AWS_REGION", value = var.aws_region },
      ]

      secrets = [
        {
          name      = "GITHUB_TOKEN"
          valueFrom = "${var.github_token_secret_arn}"
        },
        {
          name      = "ANTHROPIC_API_KEY"
          valueFrom = "${var.anthropic_api_key_secret_arn}"
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.executor.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "ecs"
        }
      }
    }
  ])

  tags = {
    Name        = "${local.name_prefix}-ai-worker-executor"
    Environment = var.environment
    Component   = "ai-workers"
  }
}

# =============================================================================
# AI Worker Watcher Lambda (Self-Recovery System)
# =============================================================================

resource "aws_cloudwatch_log_group" "watcher" {
  count             = var.enable_watcher ? 1 : 0
  name              = "/aws/lambda/${local.name_prefix}-ai-worker-watcher"
  retention_in_days = var.log_retention_days

  tags = {
    Name        = "${local.name_prefix}-ai-worker-watcher-logs"
    Environment = var.environment
    Component   = "ai-workers"
  }
}

resource "aws_iam_role" "watcher_lambda" {
  count       = var.enable_watcher ? 1 : 0
  name_prefix = "${local.name_prefix}-aiw-watcher-"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name        = "${local.name_prefix}-ai-worker-watcher-role"
    Environment = var.environment
    Component   = "ai-workers"
  }
}

resource "aws_iam_role_policy" "watcher_lambda" {
  count       = var.enable_watcher ? 1 : 0
  name_prefix = "${local.name_prefix}-aiw-watcher-"
  role        = aws_iam_role.watcher_lambda[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      # CloudWatch Logs
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:log-group:/aws/lambda/${local.name_prefix}-ai-worker-watcher:*"
      },
      # ECS - Stop stuck tasks
      {
        Effect = "Allow"
        Action = [
          "ecs:StopTask",
          "ecs:DescribeTasks"
        ]
        Resource = "arn:aws:ecs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:task/${var.ecs_cluster_name}/*"
      },
      # SQS - Send retry messages
      {
        Effect = "Allow"
        Action = [
          "sqs:SendMessage",
          "sqs:GetQueueUrl"
        ]
        Resource = aws_sqs_queue.ai_worker_tasks.arn
      },
      # Secrets Manager - Database credentials
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = var.database_secret_arn != "" ? [var.database_secret_arn] : []
      },
      # VPC access (for RDS in private subnet)
      {
        Effect = "Allow"
        Action = [
          "ec2:CreateNetworkInterface",
          "ec2:DescribeNetworkInterfaces",
          "ec2:DeleteNetworkInterface"
        ]
        Resource = "*"
      }
    ]
  })
}

# Lambda function - Note: The actual code deployment is handled separately
# This creates the Lambda configuration, but the code needs to be built and uploaded
resource "aws_lambda_function" "watcher" {
  count         = var.enable_watcher ? 1 : 0
  function_name = "${local.name_prefix}-ai-worker-watcher"
  description   = "AI Worker Watcher - detects stuck tasks, handles retries, and enforces timeouts"
  role          = aws_iam_role.watcher_lambda[0].arn
  handler       = "ai-worker-watcher.handler"
  runtime       = "nodejs18.x"
  timeout       = 60
  memory_size   = 256

  # Placeholder - actual code is deployed via CI/CD
  filename         = "${path.module}/placeholder.zip"
  source_code_hash = filebase64sha256("${path.module}/placeholder.zip")

  vpc_config {
    subnet_ids         = var.private_subnet_ids
    security_group_ids = var.security_group_ids
  }

  environment {
    variables = {
      AWS_REGION           = var.aws_region
      ECS_CLUSTER_NAME     = var.ecs_cluster_name
      AI_WORKER_QUEUE_URL  = aws_sqs_queue.ai_worker_tasks.url
      DATABASE_SECRET_ARN  = var.database_secret_arn
    }
  }

  tags = {
    Name        = "${local.name_prefix}-ai-worker-watcher"
    Environment = var.environment
    Component   = "ai-workers"
  }

  depends_on = [aws_cloudwatch_log_group.watcher]
}

# CloudWatch Events Rule - Trigger every 5 minutes
resource "aws_cloudwatch_event_rule" "watcher_schedule" {
  count               = var.enable_watcher ? 1 : 0
  name                = "${local.name_prefix}-ai-worker-watcher-schedule"
  description         = "Trigger AI Worker Watcher Lambda every 5 minutes"
  schedule_expression = var.watcher_schedule

  tags = {
    Name        = "${local.name_prefix}-ai-worker-watcher-schedule"
    Environment = var.environment
    Component   = "ai-workers"
  }
}

resource "aws_cloudwatch_event_target" "watcher" {
  count     = var.enable_watcher ? 1 : 0
  rule      = aws_cloudwatch_event_rule.watcher_schedule[0].name
  target_id = "ai-worker-watcher"
  arn       = aws_lambda_function.watcher[0].arn
}

resource "aws_lambda_permission" "watcher_cloudwatch" {
  count         = var.enable_watcher ? 1 : 0
  statement_id  = "AllowCloudWatchEventsInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.watcher[0].function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.watcher_schedule[0].arn
}
