resource "aws_ses_domain_identity" "main" {
  domain = var.domain
}

resource "aws_ses_domain_dkim" "main" {
  domain = aws_ses_domain_identity.main.domain
}

# Email identity for the "from" address
resource "aws_ses_email_identity" "noreply" {
  email = "noreply@${var.domain}"
}
