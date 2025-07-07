output "vpc_id" {
  value = module.network.vpc_id
}

output "eks_cluster_endpoint" {
  value = module.compute.eks_cluster_endpoint
}

output "rds_endpoint" {
  value = module.compute.rds_endpoint
}

output "cdn_domain_name" {
  value = module.cdn.cloudfront_domain_name
}
