# S3 bucket and CloudFront distribution for static website hosting

resource "aws_s3_bucket" "website" {
  bucket        = var.domain_name
  force_destroy = true

  tags = {
    project = var.project_tag
  }
}

resource "aws_s3_bucket_public_access_block" "website" {
  bucket = aws_s3_bucket.website.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_website_configuration" "website" {
  bucket = aws_s3_bucket.website.id

  index_document {
    suffix = "index.html"
  }

  error_document {
    key = "404.html"
  }
}

resource "aws_cloudfront_origin_access_control" "oac" {
  name                              = "${var.project_tag}-oac"
  description                       = "OAC for S3"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_distribution" "cdn" {
  enabled             = true
  default_root_object = "index.html"
  aliases             = [var.domain_name]

  origin {
    domain_name              = aws_s3_bucket.website.bucket_regional_domain_name
    origin_id                = aws_s3_bucket.website.id
    origin_access_control_id = aws_cloudfront_origin_access_control.oac.id
  }

  default_cache_behavior {
    target_origin_id       = aws_s3_bucket.website.id
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD", "OPTIONS"]
    compress               = true
  }

  custom_error_response {
    error_code         = 404
    response_page_path = "/404.html"
    response_code      = 200
  }

  custom_error_response {
    error_code         = 403
    response_page_path = "/404.html"
    response_code      = 200
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn      = var.certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2019"
  }

  tags = {
    project = var.project_tag
  }

  depends_on = [aws_s3_bucket_website_configuration.website]
}

# Bucket policy allowing CloudFront to access the bucket

data "aws_iam_policy_document" "bucket_policy" {
  statement {
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.website.arn}/*"]

    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.cdn.arn]
    }
  }
}

resource "aws_s3_bucket_policy" "website" {
  bucket     = aws_s3_bucket.website.id
  policy     = data.aws_iam_policy_document.bucket_policy.json
  depends_on = [aws_cloudfront_distribution.cdn]
}

resource "aws_route53_record" "alias" {
  count   = var.create_route53 ? 1 : 0
  zone_id = var.route53_zone_id
  name    = var.domain_name
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.cdn.domain_name
    zone_id                = aws_cloudfront_distribution.cdn.hosted_zone_id
    evaluate_target_health = false
  }
}

output "cloudfront_domain" {
  value = aws_cloudfront_distribution.cdn.domain_name
}

output "s3_bucket_name" {
  value = aws_s3_bucket.website.id
}

output "website_endpoint" {
  value = aws_s3_bucket_website_configuration.website.website_endpoint
}

