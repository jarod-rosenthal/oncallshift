variable "project" {
  description = "Project name"
  type        = string
}

variable "environment" {
  description = "Environment name (dev, prod)"
  type        = string
}

variable "fcm_api_key" {
  description = "Firebase Cloud Messaging API key for Android push notifications. Leave empty to skip FCM platform application creation."
  type        = string
  default     = ""
  sensitive   = true
}

variable "tags" {
  description = "Resource tags"
  type        = map(string)
  default     = {}
}
