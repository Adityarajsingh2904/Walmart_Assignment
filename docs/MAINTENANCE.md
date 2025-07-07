---
title: "Maintenance & On-Call Guide"
sidebar_position: 2
---

## On-Call Rotation

| Week | Primary | Backup |
|------|---------|--------|
| 1 | Alice Smith | Bob Lee |
| 2 | Carol Nguyen | Dave Chen |

PagerDuty roster: `trustvault-core`

## PagerDuty Integration

1. Create a PagerDuty service with the "Events API v2" integration.
2. Copy the integration key to GitHub secrets as `PAGERDUTY_KEY`.
3. Configure an escalation policy that notifies the on-call rotation above.

## Escalation Matrix

| Severity | Action |
|----------|-------|
| Tier 1 | Notify primary on-call via PagerDuty. |
| Tier 2 | Page both primary and backup; escalate to Dev lead if unresolved. |
| Tier 3 | Page entire engineering team and security officer. |
