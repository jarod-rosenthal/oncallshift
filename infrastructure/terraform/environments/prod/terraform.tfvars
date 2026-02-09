# =============================================================================
# OnCallShift Production Environment
# =============================================================================
# All variables have sensible defaults in variables.tf.
# Only override values that differ from defaults here.

project     = "oncallshift"
environment = "prod"
aws_region  = "us-east-2"

# Networking
vpc_cidr             = "10.0.0.0/16"
availability_zones   = ["us-east-2a", "us-east-2b"]
public_subnet_cidrs  = ["10.0.1.0/24", "10.0.2.0/24"]
private_subnet_cidrs = ["10.0.10.0/24", "10.0.11.0/24"]

# GitHub Runner
runner_instance_type = "t3.medium"
github_owner         = "jarod-rosenthal"
github_repo          = "oncallshift"

# This must be set to the ARN of the Secrets Manager secret containing
# the GitHub runner registration token. Create the secret manually:
#   aws secretsmanager create-secret --name oncallshift-prod-runner-token \
#     --secret-string "<RUNNER_REGISTRATION_TOKEN>" --region us-east-2
runner_token_secret_arn = "arn:aws:secretsmanager:us-east-2:593971626975:secret:oncallshift-prod-runner-token"
