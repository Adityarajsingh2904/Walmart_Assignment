#!/usr/bin/env bash
set -euo pipefail

LOGFILE="/var/log/health-report.log"
: "${PROM_URL:?PROM_URL is required}"
: "${SLACK_WEBHOOK:?SLACK_WEBHOOK is required}"

get_metric() {
  local query="$1"
  curl -s "$PROM_URL/api/v1/query" --data-urlencode "query=$query" | jq -r '.data.result[0].value[1]' || echo "n/a"
}

{
  CPU=$(get_metric 'avg(rate(node_cpu_seconds_total{mode!="idle"}[5m])) * 100')
  MEM=$(get_metric 'node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes * 100')
  DISK=$(get_metric 'node_filesystem_free_bytes{mountpoint="/"} / node_filesystem_size_bytes{mountpoint="/"} * 100')

  REPORT="*Daily Health Report*\nCPU Usage: ${CPU}%\nMemory Free: ${MEM}%\nDisk Free: ${DISK}%"
  curl -s -X POST -H 'Content-type: application/json' --data "{\"text\":\"$REPORT\"}" "$SLACK_WEBHOOK"
} >> "$LOGFILE" 2>&1 || {
  echo "$(date -Iseconds) Health report failed" >> "$LOGFILE"
  exit 1
}
