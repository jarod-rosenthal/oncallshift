resource "aws_secretsmanager_secret" "encryption_key" {
  name        = "${var.project}-${var.environment}-encryption-key"
  description = "Encryption key for credential encryption in OnCallShift"

  tags = var.tags
}

# Generate a random value for the encryption key
resource "random_password" "encryption_key" {
  length  = 64
  special = false
}

resource "aws_secretsmanager_secret_version" "encryption_key" {
  secret_id     = aws_secretsmanager_secret.encryption_key.id
  secret_string = random_password.encryption_key.result
}
