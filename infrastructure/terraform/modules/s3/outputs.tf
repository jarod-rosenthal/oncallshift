output "uploads_bucket_name" {
  description = "S3 uploads bucket name"
  value       = aws_s3_bucket.uploads.bucket
}

output "uploads_bucket_arn" {
  description = "S3 uploads bucket ARN"
  value       = aws_s3_bucket.uploads.arn
}

output "uploads_bucket_domain_name" {
  description = "S3 uploads bucket regional domain name"
  value       = aws_s3_bucket.uploads.bucket_regional_domain_name
}
