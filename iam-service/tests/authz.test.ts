import request from 'supertest';
import express from 'express';

// Minimal casbin mock
jest.mock('casbin', () => {
  return {
    newEnforcer: jest.fn(async () => {
      const enforcer: any = {
        policies: new Set<string>(),
        groups: new Map<string, Set<string>>()
      };
      enforcer.addPolicy = (role: string, path: string, method: string) => {
        enforcer.policies.add(`${role}|${path}|${method}`);
        return Promise.resolve(true);
      };
      enforcer.addGroupingPolicy = (sub: string, role: string) => {
        if (!enforcer.groups.has(sub)) enforcer.groups.set(sub, new Set());
        enforcer.groups.get(sub)!.add(role);
        return Promise.resolve(true);
      };
      enforcer.clearPolicy = () => { enforcer.policies.clear(); return Promise.resolve(); };
      enforcer.enforce = (sub: string, path: string, method: string) => {
        const roles = enforcer.groups.get(sub) || new Set();
        for (const r of roles) {
          if (enforcer.policies.has(`${r}|${path}|${method}`)) return Promise.resolve(true);
        }
        return Promise.resolve(false);
      };
      return enforcer;
    }),
    newModelFromString: jest.fn(),
    Enforcer: class {}
  };
});

const redisStore = new Map<string, string>();
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    get: jest.fn((key: string) => Promise.resolve(redisStore.get(key) ?? null)),
    set: jest.fn((key: string, val: string) => { redisStore.set(key, val); return Promise.resolve('OK'); })
  }));
});

const rolePolicies: any[] = [];
const abacRules: any[] = [];

jest.mock('@prisma/client', () => {
  return {
    PrismaClient: jest.fn().mockImplementation(() => ({
      role_policies: { findMany: jest.fn(() => Promise.resolve(rolePolicies)) },
      attribute_rules: { findMany: jest.fn(() => Promise.resolve(abacRules)) },
    }))
  };
});

const jwtPayload: any = {};
jest.mock('@trustvault/jwt', () => ({ verify: jest.fn(() => Promise.resolve(jwtPayload)) }), { virtual: true });

let attachAuthz: any;

function makeApp() {
  const app = express();
  attachAuthz(app);
  app.get('/healthz', (req, res) => res.send('ok'));
  app.get('/resource', (req, res) => res.json({ ok: true }));
  return app;
}

describe('authz middleware', () => {
  beforeEach(async () => {
    jest.resetModules();
    ({ attachAuthz } = require('../src/middleware/authz'));
    rolePolicies.length = 0;
    abacRules.length = 0;
    redisStore.clear();
    Object.assign(jwtPayload, { sub: 'u', jti: 'token', roles: ['r'], attrs: { level: 5 } });
    jest.clearAllMocks();
  });

  it('allow (role pass + abac pass)', async () => {
    rolePolicies.push({ role: 'r', method: 'get', path: '/resource' });
    abacRules.push({ id: '1', name: 'rule', json_logic: { '>=': [ { var: 'level' }, 5 ] } });
    const app = makeApp();
    const res = await request(app)
      .get('/resource')
      .set('Authorization', 'Bearer valid');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('deny – role fail', async () => {
    abacRules.push({ id: '1', name: 'rule', json_logic: { '>=': [ { var: 'level' }, 5 ] } });
    const app = makeApp();
    const res = await request(app)
      .get('/resource')
      .set('Authorization', 'Bearer valid');
    expect(res.status).toBe(403);
    expect(res.body.reason).toBe('rbac');
  });

  it('deny – abac fail', async () => {
    rolePolicies.push({ role: 'r', method: 'get', path: '/resource' });
    abacRules.push({ id: '1', name: 'rule', json_logic: { '>': [ { var: 'level' }, 10 ] } });
    const app = makeApp();
    const res = await request(app)
      .get('/resource')
      .set('Authorization', 'Bearer valid');
    expect(res.status).toBe(403);
    expect(res.body.reason).toBe('abac');
  });

  it('deny – JWT missing', async () => {
    const app = makeApp();
    const res = await request(app).get('/resource');
    expect(res.status).toBe(403);
    expect(res.body.reason).toBe('jwt_missing');
  });

  it('cache hit on repeat request', async () => {
    const app = makeApp();
    // first request fails rbac -> store deny
    await request(app)
      .get('/resource')
      .set('Authorization', 'Bearer valid');
    const res = await request(app)
      .get('/resource')
      .set('Authorization', 'Bearer valid');
    expect(res.status).toBe(403);
    expect(res.body.reason).toBe('cache');
  });
});
