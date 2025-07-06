variable "aws_region" {
  description = "AWS region"
  type        = string
}

variable "openai_key" {
  description = "OpenAI API key"
  type        = string
  sensitive   = true
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

variable "ec2_role_name" {
  description = "IAM role attached to the EC2 instance"
  type        = string
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

variable "domain_name" {
  description = "Domain name for the website"
  type        = string
}

variable "certificate_arn" {
  description = "ACM certificate ARN in us-east-1"
  type        = string
}

variable "create_route53" {
  description = "Create Route53 alias record"
  type        = bool
  default     = false
}

variable "route53_zone_id" {
  description = "Route53 hosted zone ID"
  type        = string
  default     = null
}

