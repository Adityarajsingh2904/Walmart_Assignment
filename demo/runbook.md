# TrustVault Demo Runbook

## Prerequisites
- AWS CLI configured
- `kubectl` installed
- `Helm` installed

## Terraform deploy (free-tier)
```bash
cd deployment/terraform/dev
terraform init
terraform apply -auto-approve
```

## Set env vars
```bash
export AWS_PROFILE=trustvault-demo
export OPENAI_KEY=...
```

## Helm install UI & services
```bash
helm repo add trustvault https://example.com/charts
helm install trustvault ./deployment/helm --namespace demo --create-namespace
```

## Login steps
```bash
aws eks update-kubeconfig --name trustvault-demo
kubectl port-forward svc/ui 3000:80
```

## Validation commands
```bash
curl http://localhost:3000/health
aws logs describe-log-groups --log-group-name-prefix /trustvault
```

## Notes
- Use free-tier resource values in Terraform variables
- Links:
  - Grafana dashboard: https://console.aws.amazon.com/grafana/
  - UI URL: http://localhost:3000
- Troubleshooting: If Helm install fails, run `helm repo update`

