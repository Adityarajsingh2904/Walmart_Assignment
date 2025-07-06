variable "aws_region" {
  description = "AWS region"
  type        = string
}

variable "db_username" {
  description = "Database master username"
  type        = string
}

variable "db_password" {
  description = "Database master password"
  type        = string
  sensitive   = true
  validation {
    condition     = length(var.db_password) >= 8
    error_message = "db_password must be at least 8 characters"
  }
}

variable "vpc_id" {
  description = "VPC ID where RDS will reside"
  type        = string
}

variable "subnet_ids" {
  description = "Subnets for the RDS subnet group"
  type        = list(string)
}

variable "allowed_cidr" {
  description = "CIDR allowed to access PostgreSQL"
  type        = string
  default     = "0.0.0.0/0"
}

variable "project_tag" {
  description = "Tag applied to resources"
  type        = string
  default     = "trustvault"
}
