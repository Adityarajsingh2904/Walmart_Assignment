# Secrets Manager secrets and IAM permissions for EC2 role

data "aws_iam_role" "ec2" {
  name = var.ec2_role_name
}

resource "aws_secretsmanager_secret" "openai" {
  name = "trustvault/openai/api_key"

  tags = {
    project = var.project_tag
  }
}

resource "aws_secretsmanager_secret_version" "openai" {
  secret_id     = aws_secretsmanager_secret.openai.id
  secret_string = var.openai_key
}

resource "aws_secretsmanager_secret" "db_username" {
  name = "trustvault/postgres/username"

  tags = {
    project = var.project_tag
  }
}

resource "aws_secretsmanager_secret_version" "db_username" {
  secret_id     = aws_secretsmanager_secret.db_username.id
  secret_string = var.db_username
}

resource "aws_secretsmanager_secret" "db_password" {
  name = "trustvault/postgres/password"

  tags = {
    project = var.project_tag
  }
}

resource "aws_secretsmanager_secret_version" "db_password" {
  secret_id     = aws_secretsmanager_secret.db_password.id
  secret_string = var.db_password
}

data "aws_iam_policy_document" "allow_read_secrets" {
  statement {
    actions = ["secretsmanager:GetSecretValue"]
    resources = [
      aws_secretsmanager_secret.openai.arn,
      aws_secretsmanager_secret.db_username.arn,
      aws_secretsmanager_secret.db_password.arn,
    ]
  }
}

resource "aws_iam_role_policy" "ec2_read_secrets" {
  name   = "${var.project_tag}-read-secrets"
  role   = data.aws_iam_role.ec2.name
  policy = data.aws_iam_policy_document.allow_read_secrets.json
}

output "openai_secret_arn" {
  value = aws_secretsmanager_secret.openai.arn
}

output "db_username_secret_arn" {
  value = aws_secretsmanager_secret.db_username.arn
}

output "db_password_secret_arn" {
  value = aws_secretsmanager_secret.db_password.arn
}
