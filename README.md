---
title: "TrustVault Project Overview"
sidebar_position: 1
---
# TrustVault

This repository contains multiple microservices and tooling used to explore security automation workflows.

## Production Endpoints

- **UI**: https://app.trustvault.io
- **API**: https://api.trustvault.io ([API Docs](/docs/api))

## Terraform Variable Guide

| Variable | Default | Description |
| -------- | ------- | ----------- |
| aws_region | | AWS region |
| openai_key | | OpenAI API key |
| db_username | | Database master username |
| db_password | | Database master password |
| ec2_role_name | | IAM role attached to the EC2 instance |
| vpc_id | | VPC ID where RDS will reside |
| subnet_ids | | Subnets for the RDS subnet group |
| allowed_cidr | "0.0.0.0/0" | CIDR allowed to access PostgreSQL |
| project_tag | "trustvault" | Tag applied to resources |
| domain_name | | Domain name for the website |
| certificate_arn | | ACM certificate ARN in us-east-1 |
| create_route53 | false | Create Route53 alias record |
| route53_zone_id | null | Route53 hosted zone ID |
| instance_id | | Existing EC2 instance ID |
| alert_email | | Email for SNS subscription |

## Secrets Setup

1. Ensure the following secrets exist in AWS Secrets Manager:
   - `arn:aws:secretsmanager:us-east-1:123456789012:secret:trustvault/openai/api_key`
   - `arn:aws:secretsmanager:us-east-1:123456789012:secret:trustvault/postgres/username`
   - `arn:aws:secretsmanager:us-east-1:123456789012:secret:trustvault/postgres/password`
2. Copy `.env.example` to `.env` and fill in local values.

GitHub Actions logs: <https://github.com/YourOrg/TrustVault/actions>
## Installation

1. Install [pnpm](https://pnpm.io) and Node.js 20 or later.
2. Install Docker and Docker Compose if you plan to run the services in containers.
3. Install Go 1.24+ and Python 3.10+ for services written in those languages.
4. Fetch all Node.js dependencies:
   ```bash
   pnpm install
   ```
5. Install Python requirements for the AI service:
   ```bash
   pip install -r ai-service/requirements.txt
   ```
6. Fetch Go modules for the IAM service:
   ```bash
   cd iam-service && go mod download && cd ..
   ```

## Usage

Each service can be run locally using pnpm or via Docker Compose. Below is a short description of each service and how to start it.

### API Gateway
An Express based gateway exposing a health check and Swagger UI.

```bash
pnpm --filter api-gateway dev       # development
pnpm --filter api-gateway build
pnpm --filter api-gateway start     # production
```

Docker:
```bash
docker compose -f api-gateway/docker-compose.override.yml up --build
```

### Ledger Service
Logs SOAR alerts to Hyperledger Fabric and exposes integrity APIs.

```bash
pnpm --filter ledger-service dev
pnpm --filter ledger-service build
pnpm --filter ledger-service start
```

Docker:
```bash
docker compose -f ledger-service/docker-compose.override.yml up --build
```

### SOAR Service
Automation engine scaffolding for orchestration tasks.

```bash
pnpm --filter soar-service dev
pnpm --filter soar-service build
pnpm --filter soar-service start
```

Docker:
```bash
docker compose -f soar-service/docker-compose.override.yml up --build
```

### IAM Service
Identity and access management implemented with both Node.js and Go.

```bash
pnpm --filter iam-service build
```

Docker:
```bash
docker compose -f iam-service/docker-compose.override.yml up --build
```

Go modules are also provided:
```bash
cd iam-service && go run ./cmd
```

### AI Service
Python service for machine learning models.

```bash
python -m ai_service.app
```

Docker:
```bash
docker compose -f ai-service/docker-compose.override.yml up --build
```

### Trainer
Python utilities for training models used by the AI service.

### UI Dashboard
Simple Vite powered dashboard.

```bash
pnpm dev
```

## Running Tests

- Node.js services:
  ```bash
  pnpm --filter <service> test
  ```
  Replace `<service>` with `api-gateway`, `ledger-service`, `soar-service` or `iam-service`.
- Go code in `iam-service`:
  ```bash
  cd iam-service && go test ./...
  ```

Tests for Docker compose services are defined as health checks in their respective docker-compose files.

## Docker Compose

Each service contains a `docker-compose.override.yml` file that can be used to build and run the service in a container. The stack in `docker-compose.ai.yml` can be used to run supporting infrastructure like Kafka, PostgreSQL and Prometheus.

```bash
docker compose -f docker-compose.ai.yml up --build
```

Refer to the individual service READMEs for more details on Docker usage.
