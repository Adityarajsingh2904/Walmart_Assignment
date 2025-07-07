# TrustVault – End-to-End Demo

---

## Architecture Overview

```mermaid
flowchart LR
    A[Users] --> B(API Gateway)
    B --> C(Anomaly Detector)
    C --> D(Ledger Service)
    C --> E(SOAR Orchestrator)
    E --> F[AWS Services]
    D --> G(UI Dashboard)
```

---

## Monitoring & Metrics

![CPU Gauge](https://example.com/grafana/cpu.png)

![Anomaly Count](https://example.com/grafana/anomalies.png)

---

## Demo Sequence

```typescript
const socket = new WebSocket('wss://demo.trustvault.ai/alerts');

socket.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Alert received', data);
};
```

```json
{
  "id": "01F4",
  "src_ip": "10.2.1.5",
  "severity": "HIGH"
}
```

---

## Response Workflow

```mermaid
sequenceDiagram
    attacker->>app: Launch attack
    app->>detector: Anomaly event
    detector->>soar: Create incident
    soar->>analyst: Notify and gather context
    analyst->>soar: Mitigation commands
    soar->>ledger: Log outcome
```

---

## Feedback Loop

- Mark false positives directly in UI
- Feedback stored in dataset for next model run
- Nightly retraining updates anomaly scoring

---

## Thank You

- Dashboard: https://console.aws.amazon.com/grafana/
- UI: https://trustvault-demo.awsapps.com
- Contact: demo@trustvault.ai

