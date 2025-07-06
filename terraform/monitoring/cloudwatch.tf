resource "aws_cloudwatch_log_group" "service_logs" {
  for_each          = toset(var.service_names)
  name              = "/trustvault/${each.value}"
  retention_in_days = 30

  tags = local.tags
}

resource "aws_cloudwatch_metric_alarm" "cpu_high" {
  for_each            = toset(var.service_names)
  alarm_name          = "${each.value}-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "CPUUtilization"
  namespace           = "AWS/EC2"
  period              = 60
  statistic           = "Average"
  threshold           = 80

  dimensions = {
    AutoScalingGroupName = each.value
  }

  treat_missing_data = "missing"

  tags = local.tags
}
