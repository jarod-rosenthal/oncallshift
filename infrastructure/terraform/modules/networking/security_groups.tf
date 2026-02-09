## Security Groups
#
# Pre-created security groups for all components. Ingress/egress rules are
# scoped minimally and reference each other so traffic only flows between
# expected layers:
#
#   Internet → ALB (80/443) → ECS (3000) → RDS (5432)
#   Runner → outbound HTTPS (GitHub API, ECR, etc.)
#
# Cross-referencing rules use aws_security_group_rule to avoid circular
# dependencies between ECS and RDS security groups.

# =============================================================================
# ALB Security Group (future — Phase 13)
# =============================================================================

resource "aws_security_group" "alb" {
  name        = "${local.name_prefix}-alb-sg"
  description = "Security group for Application Load Balancer"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "HTTP from internet"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS from internet"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "All outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-alb-sg"
  })
}

# =============================================================================
# ECS Security Group (future — Phase 13)
# =============================================================================

resource "aws_security_group" "ecs" {
  name        = "${local.name_prefix}-ecs-sg"
  description = "Security group for ECS Fargate services"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "HTTP from ALB"
    from_port       = 3000
    to_port         = 3000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    description = "HTTPS outbound"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-ecs-sg"
  })
}

# ECS → RDS egress (separate rule to avoid circular dependency)
resource "aws_security_group_rule" "ecs_to_rds" {
  type                     = "egress"
  description              = "PostgreSQL to RDS"
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  security_group_id        = aws_security_group.ecs.id
  source_security_group_id = aws_security_group.rds.id
}

# =============================================================================
# RDS Security Group (future — Phase 13)
# =============================================================================

resource "aws_security_group" "rds" {
  name        = "${local.name_prefix}-rds-sg"
  description = "Security group for RDS PostgreSQL"
  vpc_id      = aws_vpc.main.id

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-rds-sg"
  })
}

# RDS ingress from ECS (separate rule to avoid circular dependency)
resource "aws_security_group_rule" "rds_from_ecs" {
  type                     = "ingress"
  description              = "PostgreSQL from ECS"
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  security_group_id        = aws_security_group.rds.id
  source_security_group_id = aws_security_group.ecs.id
}

# RDS ingress from runner (for migrations via GitHub Actions)
resource "aws_security_group_rule" "rds_from_runner" {
  type                     = "ingress"
  description              = "PostgreSQL from GitHub runner"
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  security_group_id        = aws_security_group.rds.id
  source_security_group_id = aws_security_group.runner.id
}

# =============================================================================
# GitHub Actions Runner Security Group
# =============================================================================

resource "aws_security_group" "runner" {
  name        = "${local.name_prefix}-runner-sg"
  description = "Security group for self-hosted GitHub Actions runner"
  vpc_id      = aws_vpc.main.id

  # No inbound traffic needed — runner initiates all connections

  egress {
    description = "HTTPS outbound"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "HTTP outbound"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "DNS UDP"
    from_port   = 53
    to_port     = 53
    protocol    = "udp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "DNS TCP"
    from_port   = 53
    to_port     = 53
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-runner-sg"
  })
}

# Runner → RDS egress (for database migrations via GitHub Actions)
resource "aws_security_group_rule" "runner_to_rds" {
  type                     = "egress"
  description              = "PostgreSQL to RDS"
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  security_group_id        = aws_security_group.runner.id
  source_security_group_id = aws_security_group.rds.id
}
