terraform {
  required_version = ">= 1.5"

  backend "s3" {
    bucket = "trustvault-terraform-state"
    key    = "monitoring/terraform.tfstate"
    region = var.region
  }
}

provider "aws" {
  region = var.region
}

data "terraform_remote_state" "network" {
  backend = "s3"
  config = {
    bucket = "trustvault-terraform-state"
    key    = "network/terraform.tfstate"
    region = var.region
  }
}

resource "aws_s3_bucket" "grafana_dashboards" {
  bucket = "trustvault-grafana-dashboards-${var.environment}"

  versioning {
    enabled = true
  }

  tags = local.tags
}
