# IAM role for Prometheus node group

data "aws_iam_policy_document" "prometheus_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "prometheus_node_role" {
  name               = "prometheus-node-role-${var.environment}"
  assume_role_policy = data.aws_iam_policy_document.prometheus_assume.json

  tags = local.tags
}

resource "aws_iam_role_policy_attachment" "eks_worker" {
  role       = aws_iam_role.prometheus_node_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy"
}

resource "aws_iam_role_policy_attachment" "ecr_read" {
  role       = aws_iam_role.prometheus_node_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
}

resource "aws_iam_policy" "prometheus_scrape" {
  name   = "prometheus-scrape-${var.environment}"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = [
          "cloudwatch:ListMetrics",
          "cloudwatch:GetMetricData",
          "cloudwatch:GetMetricStatistics",
          "logs:DescribeLogStreams",
          "logs:GetLogEvents"
        ]
        Resource = "*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "scrape_attach" {
  role       = aws_iam_role.prometheus_node_role.name
  policy_arn = aws_iam_policy.prometheus_scrape.arn
}
