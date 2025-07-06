import { Router } from 'express';
import {
  collectDefaultMetrics,
  register,
  Counter,
  Histogram,
} from 'prom-client';
import type { RequestHandler } from 'express';

declare global {
  // eslint-disable-next-line no-var
  var metricsInitialized: boolean | undefined;
  // eslint-disable-next-line no-var
  var apiRequestCounter: Counter<string> | undefined;
  // eslint-disable-next-line no-var
  var ledgerLogCounter: Counter<string> | undefined;
  // eslint-disable-next-line no-var
  var apiLatencyHistogram: Histogram<string> | undefined;
}

if (!global.metricsInitialized) {
  collectDefaultMetrics();
  global.metricsInitialized = true;
}

export const apiRequestCounter =
  global.apiRequestCounter ||
  (global.apiRequestCounter = new Counter({
    name: 'api_gateway_requests_total',
    help: 'Total API Gateway requests',
    labelNames: ['route', 'status'] as const,
  }));

export const ledgerLogCounter =
  global.ledgerLogCounter ||
  (global.ledgerLogCounter = new Counter({
    name: 'ledger_log_total',
    help: 'Total ledger log operations',
    labelNames: ['status'] as const,
  }));

export const apiLatencyHistogram =
  global.apiLatencyHistogram ||
  (global.apiLatencyHistogram = new Histogram({
    name: 'api_gateway_latency_ms',
    help: 'API Gateway request latency in ms',
    labelNames: ['route', 'status'] as const,
    buckets: Array.from({ length: 10 }, (_v, i) => (i + 1) * 200),
  }));

export function trackRoute(routeId: string): RequestHandler {
  return function (req, res, next) {
    const start = process.hrtime.bigint();
    res.on('finish', () => {
      const status = String(res.statusCode);
      apiRequestCounter.inc({ route: routeId, status });
      const ms = Number(process.hrtime.bigint() - start) / 1_000_000;
      apiLatencyHistogram.observe({ route: routeId, status }, ms);
      if (routeId === 'ledger' && req.path === '/log-event') {
        const stat =
          res.statusCode >= 200 && res.statusCode < 400 ? 'success' : 'error';
        ledgerLogCounter.inc({ status: stat });
      }
    });
    next();
  };
}

export const metricsRouter = Router();
metricsRouter.get('/metrics', async (_req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

export { register };
