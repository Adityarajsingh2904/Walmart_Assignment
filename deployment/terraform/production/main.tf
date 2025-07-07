terraform {
  required_version = ">= 1.5"

  backend "s3" {
    bucket = "trustvault-terraform-state"
    key    = "production/terraform.tfstate"
    region = var.aws_region
  }
}

provider "aws" {
  region = var.aws_region
}

locals {
  common_tags = {
    Project = var.project
    Env     = var.env
  }
}

module "network" {
  source          = "../modules/network"
  vpc_cidr        = var.vpc_cidr
  public_subnets  = var.public_subnets
  private_subnets = var.private_subnets
  tags            = local.common_tags
}

module "compute" {
  source     = "../modules/compute"
  vpc_id     = module.network.vpc_id
  subnet_ids = module.network.private_subnets
  tags       = local.common_tags
}

module "cdn" {
  source              = "../modules/cdn"
  bucket_name         = "trustvault-${var.env}-assets"
  acm_certificate_arn = var.acm_certificate_arn
  tags                = local.common_tags
}

module "secrets" {
  source     = "../modules/secrets"
  openai_key = var.openai_key_secret_name
  db_creds   = var.db_creds_secret_name
  tags       = local.common_tags
}

