variable "openai_key" { type = string }
variable "db_creds" { type = string }
variable "tags" { type = map(string) }

resource "aws_secretsmanager_secret" "openai" {
  name = var.openai_key
  tags = var.tags
}

resource "aws_secretsmanager_secret" "db" {
  name = var.db_creds
  tags = var.tags
}

output "openai_secret_arn" {
  value = aws_secretsmanager_secret.openai.arn
}

output "db_secret_arn" {
  value = aws_secretsmanager_secret.db.arn
}
