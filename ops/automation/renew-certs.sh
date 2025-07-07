#!/usr/bin/env bash
set -euo pipefail

LOGFILE="/var/log/renew-certs.log"
: "${CERT_ARN:?CERT_ARN is required}"

{
  echo "$(date -Iseconds) Renewing certificate $CERT_ARN"
  aws acm renew-certificate --certificate-arn "$CERT_ARN"
  echo "Certificate renewal completed"
} >> "$LOGFILE" 2>&1 || {
  echo "$(date -Iseconds) Certificate renewal failed" >> "$LOGFILE"
  exit 1
}
