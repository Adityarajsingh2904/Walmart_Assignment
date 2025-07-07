variable "aws_region" {
  type = string
}

variable "project" {
  type    = string
  default = "TrustVault"
}

variable "env" {
  type    = string
  default = "prod"
}

variable "vpc_cidr" {
  type = string
}

variable "public_subnets" {
  type = list(string)
}

variable "private_subnets" {
  type = list(string)
}

variable "acm_certificate_arn" {
  type = string
}

variable "openai_key_secret_name" {
  type = string
}

variable "db_creds_secret_name" {
  type = string
}
