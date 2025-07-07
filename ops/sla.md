---
title: "TrustVault SLA"
sidebar_position: 4
---

# Service Level Agreement - TrustVault

This document defines the formal service commitments for the TrustVault platform.

## Availability & Latency Targets

- **Availability:** 99.9% monthly availability for the `/alerts` and `/anomaly` endpoints.
- **Latency:** p99 latency under **200&nbsp;ms** for these endpoints.
- **Error Rate:** less than **0.5%** failed requests over a rolling 30&nbsp;day window.

## Measurement Methods

Metrics are collected via Prometheus and visualized in Grafana. Key PromQL queries:

```promql
# p99 latency for /alerts and /anomaly
histogram_quantile(0.99, sum(rate(api_gateway_latency_ms_bucket{route=~"/(alerts|anomaly)"}[5m])) by (le))

# error rate percentage over 5m windows
sum(rate(api_gateway_requests_total{route=~"/(alerts|anomaly)",status!~"2.."}[5m]))
  / sum(rate(api_gateway_requests_total{route=~"/(alerts|anomaly)"}[5m])) * 100

# availability
sum(rate(api_gateway_requests_total{route=~"/(alerts|anomaly)",status=~"2.."}[5m]))
  / sum(rate(api_gateway_requests_total{route=~"/(alerts|anomaly)"}[5m]))
```

## Reporting Cadence

Compliance reports are generated **monthly** and exported as PDF files. Reports include graphs from Grafana and are archived in the internal document portal.

## Escalation Path

Operational issues follow the on-call rotation defined in [Maintenance & On-Call Guide](../docs/MAINTENANCE.md). PagerDuty service: `trustvault-core`.

## Related Dashboards & Alerts

- Grafana dashboard: [TrustVault Main](https://grafana.example.com/d/trustvault-main)
- Alert policies: `latency-alert` and `error-rate-alert` defined in [`slo.yaml`](./slo.yaml)
