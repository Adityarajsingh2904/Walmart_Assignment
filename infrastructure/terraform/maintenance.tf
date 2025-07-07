# Scheduled maintenance automation

# Package Lambda functions from shell scripts

data "archive_file" "renew_certs_zip" {
  type        = "zip"
  source_file = "${path.module}/../../ops/automation/renew-certs.sh"
  output_path = "${path.module}/renew-certs.zip"
}

data "archive_file" "vacuum_rds_zip" {
  type        = "zip"
  source_file = "${path.module}/../../ops/automation/vacuum-rds.sh"
  output_path = "${path.module}/vacuum-rds.zip"
}

# IAM role for certificate renewal Lambda
resource "aws_iam_role" "renew_certs" {
  name = "${var.project_tag}-renew-certs-lambda"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "renew_certs_basic" {
  role       = aws_iam_role.renew_certs.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "renew_certs_acm" {
  name = "${var.project_tag}-renew-certs"
  role = aws_iam_role.renew_certs.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["acm:RenewCertificate"]
      Resource = var.certificate_arn
    }]
  })
}

resource "aws_lambda_function" "renew_certs" {
  function_name    = "${var.project_tag}-renew-certs"
  role             = aws_iam_role.renew_certs.arn
  handler          = "renew-certs.sh"
  runtime          = "provided.al2"
  filename         = data.archive_file.renew_certs_zip.output_path
  source_code_hash = data.archive_file.renew_certs_zip.output_base64sha256
  environment {
    variables = {
      CERT_ARN = var.certificate_arn
    }
  }
  tags = {
    project = var.project_tag
  }
}

resource "aws_cloudwatch_event_rule" "renew_certs_schedule" {
  name                = "${var.project_tag}-renew-certs"
  schedule_expression = "cron(0 0 * * ? *)"
}

resource "aws_cloudwatch_event_target" "renew_certs_target" {
  rule      = aws_cloudwatch_event_rule.renew_certs_schedule.name
  target_id = "RenewCertsLambda"
  arn       = aws_lambda_function.renew_certs.arn
}

resource "aws_lambda_permission" "renew_certs_events" {
  statement_id  = "AllowExecutionFromEventsRenew"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.renew_certs.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.renew_certs_schedule.arn
}

# IAM role for RDS vacuum Lambda
resource "aws_iam_role" "vacuum_rds" {
  name = "${var.project_tag}-vacuum-rds-lambda"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "vacuum_rds_basic" {
  role       = aws_iam_role.vacuum_rds.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_lambda_function" "vacuum_rds" {
  function_name    = "${var.project_tag}-vacuum-rds"
  role             = aws_iam_role.vacuum_rds.arn
  handler          = "vacuum-rds.sh"
  runtime          = "provided.al2"
  filename         = data.archive_file.vacuum_rds_zip.output_path
  source_code_hash = data.archive_file.vacuum_rds_zip.output_base64sha256
  environment {
    variables = {
      DB_HOST = var.rds_host
      DB_USER = var.db_username
      DB_NAME = var.db_name
      DB_PASS = var.db_password
    }
  }
  tags = {
    project = var.project_tag
  }
}

resource "aws_cloudwatch_event_rule" "vacuum_rds_schedule" {
  name                = "${var.project_tag}-vacuum-rds"
  schedule_expression = "cron(0 3 ? * MON *)"
}

resource "aws_cloudwatch_event_target" "vacuum_rds_target" {
  rule      = aws_cloudwatch_event_rule.vacuum_rds_schedule.name
  target_id = "VacuumRdsLambda"
  arn       = aws_lambda_function.vacuum_rds.arn
}

resource "aws_lambda_permission" "vacuum_rds_events" {
  statement_id  = "AllowExecutionFromEventsVacuum"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.vacuum_rds.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.vacuum_rds_schedule.arn
}
