import express from 'express';
import request from 'supertest';
import { describe, it, expect, beforeEach } from 'vitest';
import { metricsRouter, trackRoute, register } from '../src/middleware/metrics';

beforeEach(() => {
  register.resetMetrics();
});

describe('metrics middleware', () => {
  it('exposes prometheus metrics', async () => {
    const app = express();
    app.use(metricsRouter);
    const res = await request(app).get('/metrics');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/plain/);
    expect(res.text).toContain('api_gateway_requests_total');
  });

  it('increments counters for routes', async () => {
    const app = express();
    app.get('/test', trackRoute('test'), (_req, res) => res.json({ ok: true }));
    app.use(metricsRouter);

    await request(app).get('/test');
    await request(app).get('/test');

    const res = await request(app).get('/metrics');
    expect(res.text).toContain(
      'api_gateway_requests_total{route="test",status="200"} 2',
    );
  });
});
