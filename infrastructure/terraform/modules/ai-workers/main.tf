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
      },
      # Lambda InvokeFunction for triggering Manager immediately after PR creation
      {
        Effect = "Allow"
        Action = [
          "lambda:InvokeFunction"
        ]
        Resource = var.enable_manager ? aws_lambda_function.manager[0].arn : "arn:aws:lambda:${var.aws_region}:${data.aws_caller_identity.current.account_id}:function:none"
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

# Terraform state access policy (conditional on bucket being configured)
resource "aws_iam_role_policy" "executor_terraform_state" {
  count       = var.terraform_state_bucket != "" ? 1 : 0
  name_prefix = "${local.name_prefix}-aiw-exec-tf-"
  role        = aws_iam_role.executor_task_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = concat(
      # S3 bucket access for Terraform state
      [
        {
          Effect = "Allow"
          Action = var.terraform_write_access ? [
            "s3:GetObject",
            "s3:PutObject",
            "s3:DeleteObject",
            "s3:ListBucket"
          ] : [
            "s3:GetObject",
            "s3:ListBucket"
          ]
          Resource = [
            "arn:aws:s3:::${var.terraform_state_bucket}",
            "arn:aws:s3:::${var.terraform_state_bucket}/*"
          ]
        }
      ],
      # DynamoDB for state locking (if configured)
      var.terraform_state_dynamodb_table != "" ? [
        {
          Effect = "Allow"
          Action = var.terraform_write_access ? [
            "dynamodb:GetItem",
            "dynamodb:PutItem",
            "dynamodb:DeleteItem"
          ] : [
            "dynamodb:GetItem"
          ]
          Resource = "arn:aws:dynamodb:${var.aws_region}:*:table/${var.terraform_state_dynamodb_table}"
        }
      ] : []
    )
  })
}

# Terraform infrastructure access policy - allows terraform plan/apply
resource "aws_iam_role_policy" "executor_terraform_infra" {
  count       = var.terraform_state_bucket != "" ? 1 : 0
  name_prefix = "${local.name_prefix}-aiw-exec-infra-"
  role        = aws_iam_role.executor_task_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      # ECS - Task definitions, services, clusters
      {
        Effect = "Allow"
        Action = [
          "ecs:Describe*",
          "ecs:List*",
          "ecs:RegisterTaskDefinition",
          "ecs:DeregisterTaskDefinition",
          "ecs:CreateService",
          "ecs:UpdateService",
          "ecs:DeleteService"
        ]
        Resource = "*"
      },
      # ECR - Container registries
      {
        Effect = "Allow"
        Action = [
          "ecr:Describe*",
          "ecr:List*",
          "ecr:GetAuthorizationToken",
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage"
        ]
        Resource = "*"
      },
      # Lambda - Functions
      {
        Effect = "Allow"
        Action = [
          "lambda:Get*",
          "lambda:List*",
          "lambda:CreateFunction",
          "lambda:UpdateFunctionCode",
          "lambda:UpdateFunctionConfiguration",
          "lambda:DeleteFunction",
          "lambda:AddPermission",
          "lambda:RemovePermission"
        ]
        Resource = "arn:aws:lambda:${var.aws_region}:*:function:${var.project_name}-*"
      },
      # IAM - Roles and policies (scoped to project)
      {
        Effect = "Allow"
        Action = [
          "iam:Get*",
          "iam:List*",
          "iam:PassRole"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "iam:CreateRole",
          "iam:DeleteRole",
          "iam:AttachRolePolicy",
          "iam:DetachRolePolicy",
          "iam:PutRolePolicy",
          "iam:DeleteRolePolicy",
          "iam:UpdateAssumeRolePolicy"
        ]
        Resource = "arn:aws:iam::*:role/${var.project_name}-*"
      },
      # RDS - Database
      {
        Effect = "Allow"
        Action = [
          "rds:Describe*",
          "rds:List*"
        ]
        Resource = "*"
      },
      # S3 - Buckets (scoped to project)
      {
        Effect = "Allow"
        Action = [
          "s3:Get*",
          "s3:List*",
          "s3:CreateBucket",
          "s3:DeleteBucket",
          "s3:PutBucket*"
        ]
        Resource = [
          "arn:aws:s3:::${var.project_name}-*",
          "arn:aws:s3:::${var.project_name}-*/*"
        ]
      },
      # CloudFront - CDN
      {
        Effect = "Allow"
        Action = [
          "cloudfront:Get*",
          "cloudfront:List*",
          "cloudfront:CreateDistribution",
          "cloudfront:UpdateDistribution",
          "cloudfront:DeleteDistribution",
          "cloudfront:CreateInvalidation"
        ]
        Resource = "*"
      },
      # Route53 - DNS
      {
        Effect = "Allow"
        Action = [
          "route53:Get*",
          "route53:List*",
          "route53:ChangeResourceRecordSets"
        ]
        Resource = "*"
      },
      # ACM - Certificates
      {
        Effect = "Allow"
        Action = [
          "acm:Describe*",
          "acm:List*",
          "acm:GetCertificate"
        ]
        Resource = "*"
      },
      # Cognito - User pools
      {
        Effect = "Allow"
        Action = [
          "cognito-idp:Describe*",
          "cognito-idp:List*",
          "cognito-idp:Get*"
        ]
        Resource = "*"
      },
      # SQS - Queues
      {
        Effect = "Allow"
        Action = [
          "sqs:Get*",
          "sqs:List*",
          "sqs:CreateQueue",
          "sqs:DeleteQueue",
          "sqs:SetQueueAttributes"
        ]
        Resource = "arn:aws:sqs:${var.aws_region}:*:${var.project_name}-*"
      },
      # SNS - Topics
      {
        Effect = "Allow"
        Action = [
          "sns:Get*",
          "sns:List*",
          "sns:CreateTopic",
          "sns:DeleteTopic",
          "sns:SetTopicAttributes"
        ]
        Resource = "arn:aws:sns:${var.aws_region}:*:${var.project_name}-*"
      },
      # CloudWatch - Logs and alarms
      {
        Effect = "Allow"
        Action = [
          "logs:Describe*",
          "logs:List*",
          "logs:CreateLogGroup",
          "logs:DeleteLogGroup",
          "logs:PutRetentionPolicy",
          "logs:TagLogGroup"
        ]
        Resource = "arn:aws:logs:${var.aws_region}:*:log-group:*${var.project_name}*"
      },
      {
        Effect = "Allow"
        Action = [
          "cloudwatch:Describe*",
          "cloudwatch:List*",
          "cloudwatch:Get*",
          "cloudwatch:PutMetricAlarm",
          "cloudwatch:DeleteAlarms"
        ]
        Resource = "*"
      },
      # EC2/VPC - Networking (read-only + security groups)
      {
        Effect = "Allow"
        Action = [
          "ec2:Describe*"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "ec2:CreateSecurityGroup",
          "ec2:DeleteSecurityGroup",
          "ec2:AuthorizeSecurityGroupIngress",
          "ec2:AuthorizeSecurityGroupEgress",
          "ec2:RevokeSecurityGroupIngress",
          "ec2:RevokeSecurityGroupEgress",
          "ec2:CreateTags",
          "ec2:DeleteTags"
        ]
        Resource = "*"
        Condition = {
          StringLike = {
            "ec2:ResourceTag/Name" = "${var.project_name}-*"
          }
        }
      },
      # ELB - Load balancers
      {
        Effect = "Allow"
        Action = [
          "elasticloadbalancing:Describe*"
        ]
        Resource = "*"
      },
      # EventBridge - Scheduled events
      {
        Effect = "Allow"
        Action = [
          "events:Describe*",
          "events:List*",
          "events:PutRule",
          "events:DeleteRule",
          "events:PutTargets",
          "events:RemoveTargets"
        ]
        Resource = "arn:aws:events:${var.aws_region}:*:rule/${var.project_name}-*"
      },
      # SES - Email
      {
        Effect = "Allow"
        Action = [
          "ses:Get*",
          "ses:List*",
          "ses:Describe*"
        ]
        Resource = "*"
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
      image     = "${aws_ecr_repository.ai_worker.repository_url}:v19"
      essential = true

      environment = [
        { name = "NODE_ENV", value = var.environment },
        { name = "AWS_REGION", value = var.aws_region },
        { name = "API_BASE_URL", value = var.api_base_url },
      ]

      secrets = concat([
        {
          name      = "GITHUB_TOKEN"
          valueFrom = "${var.github_token_secret_arn}"
        },
        {
          name      = "ANTHROPIC_API_KEY"
          valueFrom = "${var.anthropic_api_key_secret_arn}"
        }
      ],
      var.org_api_key_secret_arn != "" ? [
        {
          name      = "ORG_API_KEY"
          valueFrom = "${var.org_api_key_secret_arn}"
        }
      ] : [],
      var.jira_credentials_secret_arn != "" ? [
        {
          name      = "JIRA_BASE_URL"
          valueFrom = "${var.jira_credentials_secret_arn}:base_url::"
        },
        {
          name      = "JIRA_EMAIL"
          valueFrom = "${var.jira_credentials_secret_arn}:email::"
        },
        {
          name      = "JIRA_API_TOKEN"
          valueFrom = "${var.jira_credentials_secret_arn}:api_token::"
        }
      ] : [])

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
      # ECS - Stop stuck tasks AND run new executor tasks
      {
        Effect = "Allow"
        Action = [
          "ecs:RunTask",
          "ecs:StopTask",
          "ecs:DescribeTasks",
          "ecs:TagResource"
        ]
        Resource = [
          "arn:aws:ecs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:task/${var.ecs_cluster_name}/*",
          "arn:aws:ecs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:task-definition/${local.name_prefix}-ai-worker-executor:*"
        ]
      },
      # IAM PassRole for ECS task execution
      {
        Effect = "Allow"
        Action = "iam:PassRole"
        Resource = [
          aws_iam_role.executor_execution_role.arn,
          aws_iam_role.executor_task_role.arn
        ]
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
      # Secrets Manager - Database credentials, API keys for task dispatch
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = compact([
          var.database_secret_arn != "" ? var.database_secret_arn : null,
          var.github_token_secret_arn != "" ? var.github_token_secret_arn : null,
          var.anthropic_api_key_secret_arn != "" ? var.anthropic_api_key_secret_arn : null,
        ])
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
  runtime       = "nodejs20.x"
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
      REGION                        = var.aws_region
      ECS_CLUSTER_NAME              = var.ecs_cluster_name
      AI_WORKER_QUEUE_URL           = aws_sqs_queue.ai_worker_tasks.url
      DATABASE_SECRET_ARN           = var.database_secret_arn
      ANTHROPIC_API_KEY_SECRET_ARN  = var.anthropic_api_key_secret_arn
      GITHUB_TOKEN_SECRET_ARN       = var.github_token_secret_arn
      EXECUTOR_TASK_DEFINITION      = aws_ecs_task_definition.executor.family
      EXECUTOR_SUBNET_IDS           = join(",", var.private_subnet_ids)
      EXECUTOR_SECURITY_GROUP_IDS   = join(",", var.security_group_ids)
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

# =============================================================================
# AI Worker Manager Lambda (Virtual Manager for PR Reviews)
# =============================================================================

resource "aws_cloudwatch_log_group" "manager" {
  count             = var.enable_manager ? 1 : 0
  name              = "/aws/lambda/${local.name_prefix}-ai-worker-manager"
  retention_in_days = var.log_retention_days

  tags = {
    Name        = "${local.name_prefix}-ai-worker-manager-logs"
    Environment = var.environment
    Component   = "ai-workers"
  }
}

resource "aws_iam_role" "manager_lambda" {
  count       = var.enable_manager ? 1 : 0
  name_prefix = "${local.name_prefix}-aiw-manager-"

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
    Name        = "${local.name_prefix}-ai-worker-manager-role"
    Environment = var.environment
    Component   = "ai-workers"
  }
}

resource "aws_iam_role_policy" "manager_lambda" {
  count       = var.enable_manager ? 1 : 0
  name_prefix = "${local.name_prefix}-aiw-manager-"
  role        = aws_iam_role.manager_lambda[0].id

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
        Resource = "arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:log-group:/aws/lambda/${local.name_prefix}-ai-worker-manager:*"
      },
      # Secrets Manager - Database credentials, API keys, and Jira credentials
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = compact([
          var.database_secret_arn != "" ? var.database_secret_arn : null,
          var.github_token_secret_arn != "" ? var.github_token_secret_arn : null,
          var.anthropic_api_key_secret_arn != "" ? var.anthropic_api_key_secret_arn : null,
          var.jira_credentials_secret_arn != "" ? var.jira_credentials_secret_arn : null,
        ])
      },
      # VPC access for Lambda (required to connect to RDS in private subnet)
      {
        Effect = "Allow"
        Action = [
          "ec2:CreateNetworkInterface",
          "ec2:DescribeNetworkInterfaces",
          "ec2:DeleteNetworkInterface",
          "ec2:AssignPrivateIpAddresses",
          "ec2:UnassignPrivateIpAddresses"
        ]
        Resource = "*"
      }
    ]
  })
}

resource "aws_lambda_function" "manager" {
  count         = var.enable_manager ? 1 : 0
  function_name = "${local.name_prefix}-ai-worker-manager"
  role          = aws_iam_role.manager_lambda[0].arn
  runtime       = "nodejs20.x"
  handler       = "ai-worker-manager.handler"
  timeout       = 300  # 5 minutes (PR review takes longer)
  memory_size   = 512

  # Placeholder - real code deployed via CI/CD
  filename         = "${path.module}/placeholder-lambda.zip"
  source_code_hash = filebase64sha256("${path.module}/placeholder-lambda.zip")

  environment {
    variables = {
      REGION                        = var.aws_region
      ECS_CLUSTER_NAME              = var.ecs_cluster_name
      DATABASE_SECRET_ARN           = var.database_secret_arn
      ANTHROPIC_API_KEY_SECRET_ARN  = var.anthropic_api_key_secret_arn
      GITHUB_TOKEN_SECRET_ARN       = var.github_token_secret_arn
      JIRA_CREDENTIALS_SECRET_ARN   = var.jira_credentials_secret_arn
    }
  }

  vpc_config {
    subnet_ids         = var.private_subnet_ids
    security_group_ids = var.lambda_security_group_ids
  }

  tags = {
    Name        = "${local.name_prefix}-ai-worker-manager"
    Environment = var.environment
    Component   = "ai-workers"
  }

  depends_on = [
    aws_cloudwatch_log_group.manager,
    aws_iam_role_policy.manager_lambda  # Wait for VPC permissions to propagate
  ]
}

# CloudWatch Events Rule - Trigger every 2 minutes
resource "aws_cloudwatch_event_rule" "manager_schedule" {
  count               = var.enable_manager ? 1 : 0
  name                = "${local.name_prefix}-ai-worker-manager-schedule"
  description         = "Trigger AI Worker Manager Lambda every 2 minutes"
  schedule_expression = var.manager_schedule

  tags = {
    Name        = "${local.name_prefix}-ai-worker-manager-schedule"
    Environment = var.environment
    Component   = "ai-workers"
  }
}

resource "aws_cloudwatch_event_target" "manager" {
  count     = var.enable_manager ? 1 : 0
  rule      = aws_cloudwatch_event_rule.manager_schedule[0].name
  target_id = "ai-worker-manager"
  arn       = aws_lambda_function.manager[0].arn
}

resource "aws_lambda_permission" "manager_cloudwatch" {
  count         = var.enable_manager ? 1 : 0
  statement_id  = "AllowCloudWatchEventsInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.manager[0].function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.manager_schedule[0].arn
}
