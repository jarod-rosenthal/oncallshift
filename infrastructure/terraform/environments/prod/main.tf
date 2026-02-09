# =============================================================================
# OnCallShift Production Environment
# =============================================================================
#
# Phase 0.0: networking + github-runner (bootstrap — direct apply)
# Phase 0.1: managed-services (via GitHub Actions)
# Phase 13:  database + ecs-service + cdn (via GitHub Actions)

# =============================================================================
# Networking Module
# =============================================================================

module "networking" {
  source = "../../modules/networking"

  project            = var.project
  environment        = var.environment
  aws_region         = var.aws_region
  vpc_cidr           = var.vpc_cidr
  availability_zones = var.availability_zones
  public_subnet_cidrs  = var.public_subnet_cidrs
  private_subnet_cidrs = var.private_subnet_cidrs

  enable_nat_gateway   = true
  single_nat_gateway   = true
  enable_vpc_endpoints = true
}

# =============================================================================
# GitHub Actions Self-Hosted Runner
# =============================================================================

module "github_runner" {
  source = "../../modules/github-runner"

  project     = var.project
  environment = var.environment
  aws_region  = var.aws_region

  vpc_id            = module.networking.vpc_id
  subnet_id         = module.networking.private_subnet_ids[0]
  security_group_id = module.networking.runner_security_group_id

  instance_type          = var.runner_instance_type
  runner_version         = var.runner_version
  github_owner           = var.github_owner
  github_repo            = var.github_repo
  runner_token_secret_arn = var.runner_token_secret_arn
}
