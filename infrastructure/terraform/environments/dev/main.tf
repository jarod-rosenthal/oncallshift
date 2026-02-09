locals {
  common_tags = {
    Project     = var.project
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# --- Cognito (User Authentication) ---
module "cognito" {
  source = "../../modules/cognito"

  project     = var.project
  environment = var.environment
  tags        = local.common_tags
}

# --- SQS (Message Queues) ---
module "sqs" {
  source = "../../modules/sqs"

  project     = var.project
  environment = var.environment
  tags        = local.common_tags
}

# --- SES (Email) ---
module "ses" {
  source = "../../modules/ses"

  domain = var.domain
  tags   = local.common_tags
}

# --- SNS (Push Notifications) ---
module "sns" {
  source = "../../modules/sns"

  project     = var.project
  environment = var.environment
  fcm_api_key = var.fcm_api_key
  tags        = local.common_tags
}

# --- S3 (File Uploads) ---
module "s3" {
  source = "../../modules/s3"

  project      = var.project
  environment  = var.environment
  cors_origins = var.cors_origins
  tags         = local.common_tags
}

# --- Secrets Manager (Encryption Key) ---
module "secrets_manager" {
  source = "../../modules/secrets-manager"

  project     = var.project
  environment = var.environment
  tags        = local.common_tags
}
