#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: $0 [-t THRESHOLD] [-a SNS_ARN] REGION SERVICE1 [SERVICE2 ...]"
}

THRESHOLD=80
SNS_ARN="arn:aws:sns:us-east-1:123456789012:TrustVaultAlerts"

while getopts ":t:a:" opt; do
  case $opt in
    t) THRESHOLD=$OPTARG ;;
    a) SNS_ARN=$OPTARG ;;
    *) usage; exit 1 ;;
  esac
done
shift $((OPTIND -1))

if [ $# -lt 2 ]; then
  usage
  exit 1
fi

REGION=$1
shift
SERVICES=("$@")

# Install CloudWatch Agent if not already present
if ! command -v /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl &>/dev/null; then
  if [ -f /etc/os-release ]; then
    . /etc/os-release
  fi
  if [[ "$ID" == "amzn" || "$ID" == "amazon" || "$ID" == "amzn2" ]]; then
    yum install -y amazon-cloudwatch-agent
  elif [[ "$ID" == "ubuntu" ]]; then
    apt-get update
    apt-get install -y amazon-cloudwatch-agent
  fi
fi

CONFIG_FILE=/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json

mkdir -p $(dirname "$CONFIG_FILE")

LOGS_CONFIG="{\n  \"logs\": {\n    \"logs_collected\": {\n      \"files\": {\n        \"collect_list\": ["
FIRST=1
for SERVICE in "${SERVICES[@]}"; do
  LOG_GROUP="/trustvault/${SERVICE}"
  aws logs --region "$REGION" describe-log-groups --log-group-name-prefix "$LOG_GROUP" --query 'logGroups[0]' | grep -q "$LOG_GROUP" || \
    aws logs --region "$REGION" create-log-group --log-group-name "$LOG_GROUP"
  if [ $FIRST -eq 0 ]; then
    LOGS_CONFIG+=" ,"
  fi
  LOGS_CONFIG+="{\"file_path\":\"/var/log/${SERVICE}.log\",\"log_group_name\":\"${LOG_GROUP}\",\"log_stream_name\":\"{instance_id}\"}"
  FIRST=0
  # CPU alarm per service
  ALARM_NAME="${SERVICE}-cpu-high"
  aws cloudwatch put-metric-alarm \
    --region "$REGION" \
    --alarm-name "$ALARM_NAME" \
    --metric-name CPUUtilization \
    --namespace AWS/EC2 \
    --statistic Average \
    --period 60 \
    --evaluation-periods 3 \
    --threshold "$THRESHOLD" \
    --comparison-operator GreaterThanThreshold \
    --alarm-actions "$SNS_ARN" \
    --dimensions Name=InstanceId,Value=$(curl -s http://169.254.169.254/latest/meta-data/instance-id) \
    --unit Percent || true

done
LOGS_CONFIG+"]\n      }\n    }\n  }\n}"

echo -e "$LOGS_CONFIG" > "$CONFIG_FILE"

/opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -a stop || true
/opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -a fetch-config -m ec2 -c file:"$CONFIG_FILE" -s
