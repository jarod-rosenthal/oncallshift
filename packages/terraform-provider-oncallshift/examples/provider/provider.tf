# Configure the OnCallShift provider
terraform {
  required_providers {
    oncallshift = {
      source  = "oncallshift/oncallshift"
      version = "~> 0.1.0"
    }
  }
}

# Provider configuration
# API key can be set via ONCALLSHIFT_API_KEY environment variable
provider "oncallshift" {
  # api_url = "https://oncallshift.com/api/v1"  # Default
  # api_key = var.oncallshift_api_key           # Or use environment variable
}
