#!/usr/bin/env bash
set -euo pipefail

LOGFILE="/var/log/vacuum-rds.log"
: "${DB_HOST:?DB_HOST is required}"
: "${DB_USER:?DB_USER is required}"
: "${DB_NAME:?DB_NAME is required}"
: "${DB_PASS:?DB_PASS is required}"

export PGPASSWORD="$DB_PASS"

{
  echo "$(date -Iseconds) Vacuuming $DB_NAME on $DB_HOST"
  psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -c 'VACUUM ANALYZE;'
  echo "VACUUM completed"
} >> "$LOGFILE" 2>&1 || {
  echo "$(date -Iseconds) VACUUM failed" >> "$LOGFILE"
  exit 1
}
