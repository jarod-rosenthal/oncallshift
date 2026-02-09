project     = "oncallshift"
environment = "dev"
aws_region  = "us-east-2"
domain      = "oncallshift.com"

cors_origins = [
  "http://localhost:5173",
  "http://localhost:3000"
]

# FCM API key — set via TF_VAR_fcm_api_key environment variable or leave empty to skip
# fcm_api_key = ""
