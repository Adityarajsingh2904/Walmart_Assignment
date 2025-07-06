resource "aws_eks_node_group" "prometheus" {
  cluster_name    = data.terraform_remote_state.network.outputs.eks_cluster_name
  node_group_name = "prometheus"
  node_role_arn   = aws_iam_role.prometheus_node_role.arn
  subnet_ids      = data.terraform_remote_state.network.outputs.private_subnet_ids

  scaling_config {
    desired_size = 1
    max_size     = 1
    min_size     = 1
  }

  instance_types = ["t3.micro"]

  tags = local.tags
}
