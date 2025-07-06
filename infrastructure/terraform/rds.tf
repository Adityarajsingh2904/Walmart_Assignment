# AWS RDS PostgreSQL free-tier instance with credentials stored in Secrets Manager

resource "aws_security_group" "rds_sg" {
  name        = "${var.project_tag}-rds-sg"
  description = "Allow PostgreSQL access"
  vpc_id      = var.vpc_id

  ingress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = [var.allowed_cidr]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    project = var.project_tag
  }
}

resource "aws_db_subnet_group" "rds" {
  name       = "${var.project_tag}-rds-subnet-group"
  subnet_ids = var.subnet_ids

  tags = {
    project = var.project_tag
  }
}

resource "aws_secretsmanager_secret" "db" {
  name = "${var.project_tag}-rds-credentials"

  tags = {
    project = var.project_tag
  }
}

resource "aws_secretsmanager_secret_version" "db" {
  secret_id = aws_secretsmanager_secret.db.id
  secret_string = jsonencode({
    username = var.db_username
    password = var.db_password
  })
}

resource "aws_db_parameter_group" "trustvault_pg15" {
  name   = "trustvault-pg15"
  family = "postgres15"

  parameter {
    name  = "log_min_duration_statement"
    value = "1000"
  }

  tags = {
    project = var.project_tag
  }
}

resource "aws_db_instance" "postgres" {
  identifier              = "${var.project_tag}-pg"
  engine                  = "postgres"
  engine_version          = "15"
  instance_class          = "db.t3.micro"
  allocated_storage       = 20
  username                = var.db_username
  password                = var.db_password
  db_subnet_group_name    = aws_db_subnet_group.rds.name
  vpc_security_group_ids  = [aws_security_group.rds_sg.id]
  publicly_accessible     = true
  backup_retention_period = 7
  skip_final_snapshot     = true
  parameter_group_name    = aws_db_parameter_group.trustvault_pg15.name

  tags = {
    project = var.project_tag
  }
}

output "rds_endpoint" {
  value = format("%s:%s", aws_db_instance.postgres.address, aws_db_instance.postgres.port)
}

output "secret_arn" {
  value = aws_secretsmanager_secret.db.arn
}

output "psql_connect_command" {
  value = "psql -h ${aws_db_instance.postgres.address} -U ${var.db_username} -d postgres"
}
