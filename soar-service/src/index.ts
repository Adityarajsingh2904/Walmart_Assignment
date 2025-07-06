import express from 'express';
import { collectDefaultMetrics, register } from 'prom-client';
import config from './config';
export { runPlaybook } from './engine';

collectDefaultMetrics();

const app = express();
app.use(express.json());

app.get('/healthz', (_req, res) => {
  res.json({ status: 'ok', service: 'soar-service' });
});

app.get('/metrics', async (_req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

app.post('/playbooks/run', (_req, res) => {
  res.sendStatus(202);
});

export function start() {
  app.listen(Number(config.METRICS_PORT), () => {
    console.log(`soar-service listening on ${config.METRICS_PORT}`);
  });
}

if (require.main === module) {
  start();
}

export default app;
