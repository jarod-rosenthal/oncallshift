locals {
  name_prefix = "${var.project}-${var.environment}"

  common_tags = merge(var.tags, {
    Project     = var.project
    Environment = var.environment
    ManagedBy   = "terraform"
  })
}

# ------------------------------------------------------------------------------
# IAM Role for the runner
# ------------------------------------------------------------------------------

resource "aws_iam_role" "runner" {
  name = "${local.name_prefix}-github-runner"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })

  tags = local.common_tags
}

# SSM access for debugging/management (no SSH needed)
resource "aws_iam_role_policy_attachment" "runner_ssm" {
  role       = aws_iam_role.runner.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

# ECR access for pushing/pulling Docker images
resource "aws_iam_role_policy_attachment" "runner_ecr" {
  role       = aws_iam_role.runner.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryPowerUser"
}

# Terraform needs broad permissions to manage infrastructure.
# This is scoped to the runner role only — not a user or external entity.
resource "aws_iam_role_policy" "runner_terraform" {
  name = "${local.name_prefix}-runner-terraform"
  role = aws_iam_role.runner.id

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
        Resource = "arn:aws:dynamodb:us-east-1:*:table/workermill-terraform-locks"
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

# Instance profile
resource "aws_iam_instance_profile" "runner" {
  name = "${local.name_prefix}-github-runner"
  role = aws_iam_role.runner.name

  tags = local.common_tags
}

# ------------------------------------------------------------------------------
# Get latest Amazon Linux 2023 AMI
# ------------------------------------------------------------------------------

data "aws_ami" "amazon_linux_2023" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-2023*-x86_64"]
  }

  filter {
    name   = "state"
    values = ["available"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# ------------------------------------------------------------------------------
# EC2 Instance — Self-hosted GitHub Actions Runner
# ------------------------------------------------------------------------------

resource "aws_instance" "runner" {
  ami                    = data.aws_ami.amazon_linux_2023.id
  instance_type          = var.instance_type
  subnet_id              = var.subnet_id
  vpc_security_group_ids = [var.security_group_id]
  iam_instance_profile   = aws_iam_instance_profile.runner.name

  root_block_device {
    volume_size           = var.root_volume_size
    volume_type           = "gp3"
    encrypted             = true
    delete_on_termination = true
  }

  user_data = base64encode(templatefile("${path.module}/user_data.sh", {
    github_owner       = var.github_owner
    github_repo        = var.github_repo
    github_runner_token = var.github_runner_token
    runner_labels      = join(",", var.runner_labels)
    runner_name        = "${local.name_prefix}-runner"
    runner_version     = var.runner_version
  }))

  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required" # IMDSv2 only
    http_put_response_hop_limit = 1
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-github-runner"
  })

  lifecycle {
    ignore_changes = [ami, user_data]
  }
}
