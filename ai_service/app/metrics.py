from __future__ import annotations

from prometheus_client import Histogram, Counter, start_http_server

# Metrics definitions
DB_LATENCY_SECONDS = Histogram(
    "db_latency_seconds",
    "Database operation latency",
    ["outcome"],
    buckets=[0.005, 0.01, 0.05, 0.1, 0.5],
)
KAFKA_PUBLISH_SECONDS = Histogram(
    "kafka_publish_seconds",
    "Kafka publish latency",
    ["outcome"],
    buckets=[0.005, 0.01, 0.05, 0.1],
)
FAILED_TX_TOTAL = Counter(
    "failed_tx_total",
    "Failed transactions",
    ["stage"],
)


def start_metrics_server(port: int = 9103) -> None:
    """Start Prometheus metrics HTTP server."""
    try:
        start_http_server(port)
    except Exception:
        # ignore errors in restricted environments
        pass


# start metrics server on import
start_metrics_server()
