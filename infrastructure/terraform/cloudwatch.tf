# CloudWatch agent setup and monitoring for an existing instance

locals {
  cloudwatch_agent_user_data = <<EOF
#!/bin/bash
set -e

if [ -f /etc/os-release ]; then
  . /etc/os-release
fi

# Install CloudWatch Agent depending on OS
if [[ "$ID" == "amzn" || "$ID" == "amazon" || "$ID" == "amzn2" ]]; then
  yum install -y amazon-cloudwatch-agent
elif [[ "$ID" == "ubuntu" ]]; then
  apt-get update
  apt-get install -y amazon-cloudwatch-agent
fi

cat <<'CONFIG' > /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json
{
  "metrics": {
    "metrics_collected": {
      "cpu": {},
      "mem": {},
      "disk": { "resources": ["*"] }
    }
  }
}
CONFIG

systemctl enable amazon-cloudwatch-agent
systemctl start amazon-cloudwatch-agent
EOF
}

# IAM role and instance profile for the CloudWatch agent

data "aws_iam_policy_document" "cw_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "cloudwatch_agent" {
  name               = "${var.project_tag}-cw-agent-role"
  assume_role_policy = data.aws_iam_policy_document.cw_assume_role.json

  tags = {
    project = var.project_tag
  }
}

resource "aws_iam_role_policy_attachment" "cw_agent" {
  role       = aws_iam_role.cloudwatch_agent.name
  policy_arn = "arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy"
}

resource "aws_iam_instance_profile" "cloudwatch_agent" {
  name = "${var.project_tag}-cw-agent-profile"
  role = aws_iam_role.cloudwatch_agent.name

  tags = {
    project = var.project_tag
  }
}


# SNS topic and subscription for alerts
resource "aws_sns_topic" "alerts" {
  name = "${var.project_tag}-alerts"

  tags = {
    project = var.project_tag
  }
}

resource "aws_sns_topic_subscription" "email" {
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

# CloudWatch alarm for high CPU usage
resource "aws_cloudwatch_metric_alarm" "cpu_utilization_high" {
  alarm_name          = "${var.project_tag}-${var.instance_id}-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "CPUUtilization"
  namespace           = "AWS/EC2"
  period              = 60
  statistic           = "Average"
  threshold           = 80
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    InstanceId = var.instance_id
  }

  tags = {
    project = var.project_tag
  }
}

output "sns_topic_arn" {
  value = aws_sns_topic.alerts.arn
}

output "cloudwatch_alarm_arn" {
  value = aws_cloudwatch_metric_alarm.cpu_utilization_high.arn
}
