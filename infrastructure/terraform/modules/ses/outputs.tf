output "domain_identity_arn" {
  description = "SES domain identity ARN"
  value       = aws_ses_domain_identity.main.arn
}

output "domain_identity_verification_token" {
  description = "SES domain verification token (add as TXT record)"
  value       = aws_ses_domain_identity.main.verification_token
}

output "dkim_tokens" {
  description = "DKIM CNAME tokens (add as DNS records)"
  value       = aws_ses_domain_dkim.main.dkim_tokens
}

output "from_email" {
  description = "Verified from email address"
  value       = aws_ses_email_identity.noreply.email
}
