variable "domain" {
  description = "Domain for SES identity (e.g. oncallshift.com)"
  type        = string
}

variable "tags" {
  description = "Resource tags"
  type        = map(string)
  default     = {}
}
