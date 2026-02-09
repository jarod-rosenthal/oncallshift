variable "project" {
  description = "Project name"
  type        = string
}

variable "environment" {
  description = "Environment name (dev, prod)"
  type        = string
}

variable "cors_origins" {
  description = "Allowed CORS origins for presigned URL uploads"
  type        = list(string)
  default     = ["http://localhost:5173"]
}

variable "tags" {
  description = "Resource tags"
  type        = map(string)
  default     = {}
}
