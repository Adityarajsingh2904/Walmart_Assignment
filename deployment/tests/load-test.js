import http from 'k6/http';
import ws from 'k6/ws';
import { check } from 'k6';
import { Trend, Counter } from 'k6/metrics';
import { scenario } from 'k6/execution';

// custom metric to count websocket messages
const wsMessages = new Counter('ws_received_messages');

export let thresholds = {
  'http_req_duration{scenario:ingest_alerts}': ['p(95)<200'],
  'http_req_failed{scenario:ingest_alerts}': ['rate<0.01'],
  'ws_duration{scenario:ws_clients}': ['p(95)<200'],
  'ws_errors{scenario:ws_clients}': ['rate<0.01'],
};

export let options = {
  scenarios: {
    ingest_alerts: {
      executor: 'constant-arrival-rate',
      rate: 1000,
      timeUnit: '1s',
      duration: '5m',
      startTime: '1m',
      preAllocatedVUs: 50,
      maxVUs: 1000,
    },
    ws_clients: {
      executor: 'constant-vus',
      vus: 100,
      duration: '5m',
      startTime: '1m',
    },
  },
  thresholds,
};

function ingestAlert() {
  const url = `${__ENV.TARGET_URL}/alerts`;
  const payload = JSON.stringify({
    message: 'load test',
    ts: Date.now(),
  });
  const params = { headers: { 'Content-Type': 'application/json' } };
  const res = http.post(url, payload, params);
  check(res, { 'status 200': r => r.status === 200 });
}

function wsClient() {
  const url = `${__ENV.TARGET_URL.replace(/^http/, 'ws')}/socket`;
  const res = ws.connect(url, (socket) => {
    socket.on('open', () => {
      socket.send(JSON.stringify({ action: 'subscribe' }));
    });
    socket.on('message', () => {
      wsMessages.add(1);
    });
    socket.setTimeout(() => socket.close(), 10000);
  });
  check(res, { 'status 101': r => r && r.status === 101 });
}

export default function () {
  if (scenario.name === 'ingest_alerts') {
    ingestAlert();
  } else if (scenario.name === 'ws_clients') {
    wsClient();
  }
}
