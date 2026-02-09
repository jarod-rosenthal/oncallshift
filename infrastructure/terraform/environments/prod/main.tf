# ------------------------------------------------------------------------------
# OnCallShift Production Environment
# ------------------------------------------------------------------------------
# Phase 0.0: VPC networking + GitHub Actions self-hosted runner
# Phase 0.1: Managed services (Cognito, SQS, SES, SNS, S3) — added later
# Phase 13:  Compute (ECS, RDS, ALB, CloudFront) — added later
# ------------------------------------------------------------------------------

# ------------------------------------------------------------------------------
# Networking Module — VPC, subnets, NAT, security groups, VPC endpoints
# ------------------------------------------------------------------------------

module "networking" {
  source = "../../modules/networking"

  project     = var.project
  environment = var.environment

  vpc_cidr             = var.vpc_cidr
  public_subnet_cidrs  = var.public_subnet_cidrs
  private_subnet_cidrs = var.private_subnet_cidrs
  availability_zones   = var.availability_zones

  enable_vpc_endpoints = true
}

# ------------------------------------------------------------------------------
# GitHub Actions Self-Hosted Runner
# ------------------------------------------------------------------------------

module "github_runner" {
  source = "../../modules/github-runner"

  project     = var.project
  environment = var.environment

  instance_type     = var.runner_instance_type
  subnet_id         = module.networking.private_subnet_ids[0]
  security_group_id = module.networking.runner_security_group_id
  vpc_id            = module.networking.vpc_id

  github_owner        = var.github_owner
  github_repo         = var.github_repo
  github_runner_token = var.github_runner_token
  runner_labels       = ["oncallshift"]
}

# ------------------------------------------------------------------------------
# GitHub Actions OIDC Provider — allows GitHub Actions to assume an IAM role
# without long-lived credentials
# ------------------------------------------------------------------------------

resource "aws_iam_openid_connect_provider" "github_actions" {
  url = "https://token.actions.githubusercontent.com"

  client_id_list = ["sts.amazonaws.com"]

  thumbprint_list = [var.github_oidc_thumbprint]

  tags = {
    Name = "${var.project}-${var.environment}-github-oidc"
  }
}

# IAM role that GitHub Actions workflows can assume via OIDC
resource "aws_iam_role" "github_actions" {
  name = "${var.project}-${var.environment}-github-actions"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = aws_iam_openid_connect_provider.github_actions.arn
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
          }
          StringLike = {
            "token.actions.githubusercontent.com:sub" = "repo:${var.github_owner}/${var.github_repo}:*"
          }
        }
      }
    ]
  })

  tags = {
    Name = "${var.project}-${var.environment}-github-actions"
  }
}

# Policy for GitHub Actions role — scoped to what CI/CD needs
resource "aws_iam_role_policy" "github_actions_terraform" {
  name = "${var.project}-${var.environment}-github-actions-terraform"
  role = aws_iam_role.github_actions.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "TerraformStateAccess"
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ]
        Resource = [
          "arn:aws:s3:::workermill-terraform-state-593971626975",
          "arn:aws:s3:::workermill-terraform-state-593971626975/oncallshift/*"
        ]
      },
      {
        Sid    = "TerraformLockAccess"
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:DeleteItem"
        ]
        Resource = "arn:aws:dynamodb:us-east-1:${var.aws_account_id}:table/workermill-terraform-locks"
      },
      {
        Sid    = "TerraformResourceManagement"
        Effect = "Allow"
        Action = [
          "ec2:*",
          "ecs:*",
          "ecr:*",
          "rds:*",
          "elasticloadbalancing:*",
          "s3:*",
          "sqs:*",
          "sns:*",
          "ses:*",
          "cognito-idp:*",
          "secretsmanager:*",
          "cloudfront:*",
          "acm:*",
          "route53:*",
          "iam:*",
          "logs:*",
          "cloudwatch:*",
          "application-autoscaling:*",
          "ssm:*"
        ]
        Resource = "*"
      }
    ]
  })
}

# ECR access for pushing Docker images from GitHub Actions
resource "aws_iam_role_policy" "github_actions_ecr" {
  name = "${var.project}-${var.environment}-github-actions-ecr"
  role = aws_iam_role.github_actions.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ecr:GetAuthorizationToken",
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "ecr:PutImage",
          "ecr:InitiateLayerUpload",
          "ecr:UploadLayerPart",
          "ecr:CompleteLayerUpload"
        ]
        Resource = "*"
      }
    ]
  })
}

# S3 access for frontend deployment from GitHub Actions
resource "aws_iam_role_policy" "github_actions_s3_deploy" {
  name = "${var.project}-${var.environment}-github-actions-s3-deploy"
  role = aws_iam_role.github_actions.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ]
        Resource = [
          "arn:aws:s3:::${var.project}-${var.environment}-*",
          "arn:aws:s3:::${var.project}-${var.environment}-*/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "cloudfront:CreateInvalidation"
        ]
        Resource = "*"
      }
    ]
  })
}

# ECS deployment access from GitHub Actions
resource "aws_iam_role_policy" "github_actions_ecs_deploy" {
  name = "${var.project}-${var.environment}-github-actions-ecs-deploy"
  role = aws_iam_role.github_actions.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ecs:UpdateService",
          "ecs:DescribeServices",
          "ecs:DescribeTaskDefinition",
          "ecs:RegisterTaskDefinition",
          "ecs:ListTasks",
          "ecs:DescribeTasks",
          "iam:PassRole"
        ]
        Resource = "*"
      }
    ]
  })
}
