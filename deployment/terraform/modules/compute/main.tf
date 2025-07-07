variable "vpc_id" { type = string }
variable "subnet_ids" { type = list(string) }
variable "tags" { type = map(string) }

# EKS cluster with control plane logging
resource "aws_eks_cluster" "this" {
  name     = "trustvault-${var.tags.Env}-eks"
  role_arn = aws_iam_role.eks_cluster.arn
  vpc_config {
    subnet_ids = var.subnet_ids
  }
  enabled_cluster_log_types = ["api", "authenticator", "controllerManager", "scheduler"]
  tags                      = var.tags
}

resource "aws_iam_role" "eks_cluster" {
  name               = "trustvault-${var.tags.Env}-eks-role"
  assume_role_policy = data.aws_iam_policy_document.eks_assume.json
  tags               = var.tags
}

data "aws_iam_policy_document" "eks_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["eks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role_policy_attachment" "eks_service" {
  role       = aws_iam_role.eks_cluster.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy"
}

# RDS Postgres with automated backups and replica
resource "aws_db_subnet_group" "rds" {
  name       = "trustvault-${var.tags.Env}-rds"
  subnet_ids = var.subnet_ids
  tags       = var.tags
}

resource "aws_db_instance" "primary" {
  identifier              = "trustvault-${var.tags.Env}-pg"
  engine                  = "postgres"
  engine_version          = "15"
  instance_class          = "db.t3.micro"
  allocated_storage       = 20
  username                = "tvadmin"
  password                = "temporarypass1" # should come from secrets
  db_subnet_group_name    = aws_db_subnet_group.rds.name
  vpc_security_group_ids  = [aws_security_group.rds.id]
  backup_retention_period = 7
  monitoring_interval     = 60
  multi_az                = true
  skip_final_snapshot     = true
  tags                    = var.tags
}

resource "aws_db_instance" "replica" {
  identifier             = "trustvault-${var.tags.Env}-pg-replica"
  replicate_source_db    = aws_db_instance.primary.identifier
  instance_class         = "db.t3.micro"
  monitoring_interval    = 60
  db_subnet_group_name   = aws_db_subnet_group.rds.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  tags                   = var.tags
}

data "aws_vpc" "selected" {
  id = var.vpc_id
}

resource "aws_security_group" "rds" {
  name   = "trustvault-${var.tags.Env}-rds-sg"
  vpc_id = var.vpc_id
  ingress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = [data.aws_vpc.selected.cidr_block]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  tags = var.tags
}

resource "aws_msk_cluster" "this" {
  cluster_name           = "trustvault-${var.tags.Env}-msk"
  kafka_version          = "3.6.0"
  number_of_broker_nodes = 2
  broker_node_group_info {
    instance_type   = "kafka.t3.small"
    client_subnets  = var.subnet_ids
    security_groups = [aws_security_group.rds.id]
  }
  encryption_info {
    encryption_at_rest_kms_key_arn = aws_kms_key.msk.arn
  }
  tags = var.tags
}

resource "aws_kms_key" "msk" {
  description = "MSK encryption key"
  tags        = var.tags
}

output "eks_cluster_endpoint" {
  value = aws_eks_cluster.this.endpoint
}

output "rds_endpoint" {
  value = aws_db_instance.primary.address
}
