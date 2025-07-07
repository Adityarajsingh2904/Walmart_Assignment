---
title: "Phase 11 Roadmap"
sidebar_position: 3
---

## Multi-Region Deployment

- Replicate infrastructure to `us-west-2` in addition to `us-east-1`.
- Use Route 53 latency-based routing for API and UI endpoints.

## ML Retraining Pipeline Enhancements

- Schedule weekly retraining jobs using GitHub Actions.
- Store versioned models in S3 with lifecycle policies.

## XDR Extension

- Integrate endpoint telemetry into the SOAR pipeline.
- Correlate alerts with existing ledger data for threat hunting.
