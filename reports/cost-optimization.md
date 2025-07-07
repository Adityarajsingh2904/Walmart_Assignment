# AWS Cost Optimization Report

This report summarizes AWS spending in the last 30 days and provides optimization recommendations. The AWS CLI commands shown below illustrate how the data can be retrieved via Cost Explorer. Actual numbers are based on example values.

## Example Cost Explorer Commands

```bash
# Costs by service grouped monthly for the last 30 days
aws ce get-cost-and-usage \
  --time-period Start=$(date -u -d "30 days ago" +%Y-%m-%d),End=$(date -u +%Y-%m-%d) \
  --granularity MONTHLY \
  --metrics BlendedCost \
  --group-by Type=DIMENSION,Key=SERVICE
```
```
# EC2 usage breakdown by instance type
aws ce get-cost-and-usage \
  --time-period Start=$(date -u -d "30 days ago" +%Y-%m-%d),End=$(date -u +%Y-%m-%d) \
  --granularity MONTHLY \
  --metrics UsageQuantity \
  --filter '{"Dimensions":{"Key":"SERVICE","Values":["Amazon Elastic Compute Cloud - Compute"]}}' \
  --group-by Type=DIMENSION,Key=INSTANCE_TYPE
```
```
# RDS cost details
aws ce get-cost-and-usage \
  --time-period Start=$(date -u -d "30 days ago" +%Y-%m-%d),End=$(date -u +%Y-%m-%d) \
  --granularity MONTHLY \
  --metrics BlendedCost \
  --filter '{"Dimensions":{"Key":"SERVICE","Values":["Amazon Relational Database Service"]}}'
```
```
# S3 storage costs
aws ce get-cost-and-usage \
  --time-period Start=$(date -u -d "30 days ago" +%Y-%m-%d),End=$(date -u +%Y-%m-%d) \
  --granularity MONTHLY \
  --metrics BlendedCost \
  --filter '{"Dimensions":{"Key":"SERVICE","Values":["Amazon Simple Storage Service"]}}'
```
```
# MSK costs
aws ce get-cost-and-usage \
  --time-period Start=$(date -u -d "30 days ago" +%Y-%m-%d),End=$(date -u +%Y-%m-%d) \
  --granularity MONTHLY \
  --metrics BlendedCost \
  --filter '{"Dimensions":{"Key":"SERVICE","Values":["Amazon Managed Streaming for Kafka"]}}'
```

*Note: Commands may require AWS credentials and appropriate IAM permissions.*

## Current Spending Summary (last 30 days)

| Service                                   | Monthly Cost | Notes                             |
|-------------------------------------------|--------------|----------------------------------|
| Amazon EC2 / EKS nodes                    | $10,000      | Compute resources for clusters   |
| Amazon RDS                                | $4,000       | Includes one idle read replica   |
| Amazon S3                                 | $1,000       | Logs and object storage          |
| Amazon MSK                                | $2,000       | Streaming infrastructure         |
| **Total**                                 | **$17,000**  |                                  |

## Underutilized Resources

- **EC2/EKS nodes**: Several nodes exhibit CPU utilization below 20%, indicating oversized instances.
- **RDS read replica**: Detected an idle read replica receiving no traffic.

## Recommended Optimizations

| Recommendation                                      | Estimated Monthly Savings | RICE Priority |
|----------------------------------------------------|--------------------------|---------------|
| Right-size low-CPU nodes to `t3.small` or utilize spot instances | $4,000 | High |
| Enable cluster autoscaling on EKS                   | $2,000 | Medium |
| Remove or enable auto-pause for idle RDS read replica | $2,000 | High |
| Archive old S3 logs to Glacier                      | $300  | Low |
| **Total Potential Savings**                         | **$8,300** |               |

## Additional Actions

- Monitor CPU metrics and adjust instance types periodically.
- Review MSK usage for possible consolidation if throughput is low.
- Evaluate Savings Plans or Reserved Instances for stable workloads.

Implementing the above optimizations can reduce monthly AWS costs by approximately **$8.3k**, representing nearly a 49% reduction from current spending.
