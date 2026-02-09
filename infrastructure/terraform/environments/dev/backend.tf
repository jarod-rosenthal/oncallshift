terraform {
  backend "s3" {
    bucket         = "workermill-terraform-state-593971626975"
    key            = "oncallshift/dev/terraform.tfstate"
    region         = "us-east-1" # State bucket is in us-east-1 (DO NOT change)
    dynamodb_table = "workermill-terraform-locks"
    encrypt        = true
  }
}
