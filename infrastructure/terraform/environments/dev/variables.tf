variable "project" {
  description = "Project name"
  type        = string
  default     = "oncallshift"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "dev"
}

variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  default     = "us-east-2"
}

variable "domain" {
  description = "Domain for SES identity"
  type        = string
  default     = "oncallshift.com"
}

variable "cors_origins" {
  description = "Allowed CORS origins for S3 presigned uploads"
  type        = list(string)
  default     = ["http://localhost:5173"]
}

variable "fcm_api_key" {
  description = "Firebase Cloud Messaging API key for Android push. Leave empty to skip FCM platform application."
  type        = string
  default     = ""
  sensitive   = true
}
