output "grafana_bucket" {
  value = aws_s3_bucket.grafana_dashboards.id
}

output "prometheus_node_role_arn" {
  value = aws_iam_role.prometheus_node_role.arn
}
