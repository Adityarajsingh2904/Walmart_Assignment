variable "region" {
  type    = string
  default = "us-east-1"
}

variable "environment" {
  type    = string
  default = "dev"
}

variable "service_names" {
  type    = list(string)
  default = ["api", "iam", "soar"]
}

locals {
  tags = {
    Environment = var.environment
    Project     = "TrustVault"
  }
}
