import request from 'supertest';
import express from 'express';
import Redis from 'ioredis';

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

let mountSessionRoutes: any;
let redisStore: Map<string, string>;
let jwtPayload: any = {};

const sessions: any[] = [];
const rolePolicies: any[] = [];
const abacRules: any[] = [];

jest.mock('@prisma/client', () => {
  return {
    PrismaClient: jest.fn().mockImplementation(() => ({
      sessions: {
        findMany: jest.fn(({ where, orderBy, take }: any) => {
          let list = sessions.filter(s => s.user_id === where.user_id);
          if (where.created_at && where.created_at.lt) {
            list = list.filter(s => s.created_at < where.created_at.lt);
          }
          list = list.sort((a,b) => b.created_at.getTime() - a.created_at.getTime());
          if (take) list = list.slice(0, take);
          return Promise.resolve(list);
        }),
        findUnique: jest.fn(({ where }: any) => Promise.resolve(sessions.find(s => s.jti === where.jti) || null)),
        update: jest.fn(({ where, data }: any) => { const s = sessions.find(x => x.jti === where.jti)!; Object.assign(s, data); return Promise.resolve(s); }),
      },
      role_policies: {
        findMany: jest.fn(() => Promise.resolve(rolePolicies))
      },
      attribute_rules: {
        findMany: jest.fn(() => Promise.resolve(abacRules))
      }
    }))
  };
});

redisStore = new Map();
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    get: jest.fn((k: string) => Promise.resolve(redisStore.get(k) ?? null)),
    set: jest.fn((k: string, v: string) => { redisStore.set(k, v); return Promise.resolve('OK'); }),
    setex: jest.fn((k: string, ttl: number, v: string) => { redisStore.set(k, v); return Promise.resolve('OK'); })
  }));
});

jest.mock('structlog', () => ({ logger: { info: jest.fn() } }), { virtual: true });

jest.mock('@trustvault/jwt', () => ({ verify: jest.fn(() => Promise.resolve(jwtPayload)) }), { virtual: true });

beforeEach(async () => {
  jest.resetModules();
  ({ mountSessionRoutes } = await import('../src/routes/sessions'));
  redisStore.clear();
  rolePolicies.length = 0;
  abacRules.length = 0;
  rolePolicies.push(
    { role: 'user', path: '/sessions', method: 'get' },
    { role: 'user', path: '/sessions/s1', method: 'delete' },
    { role: 'user', path: '/sessions/s2', method: 'delete' },
    { role: 'admin', path: '/sessions', method: 'get' },
    { role: 'admin', path: '/sessions/s1', method: 'delete' },
    { role: 'admin', path: '/sessions/s2', method: 'delete' },
    { role: 'admin', path: '/sessions/s3', method: 'delete' }
  );
  sessions.length = 0;
  sessions.push(
    { jti: 's1', user_id: 'u1', ip: '1.2.3.4', ua: 'ua', created_at: new Date('2025-07-07T05:32:10Z'), last_seen: new Date('2025-07-07T06:10:05Z'), revoked: false, revoked_at: null },
    { jti: 's2', user_id: 'u1', ip: '1.2.3.5', ua: 'ua2', created_at: new Date('2025-07-07T04:32:10Z'), last_seen: new Date('2025-07-07T05:10:05Z'), revoked: true, revoked_at: new Date('2025-07-07T06:00:00Z') },
    { jti: 's3', user_id: 'u2', ip: '1.2.3.6', ua: 'ua3', created_at: new Date('2025-07-07T03:32:10Z'), last_seen: new Date('2025-07-07T04:10:05Z'), revoked: false, revoked_at: null },
  );
  Object.assign(jwtPayload, { sub: 'u1', jti: 't', roles: ['user'] });
});

function makeApp() {
  const app = express();
  app.use(express.json());
  app.locals.redis = new Redis();
  mountSessionRoutes(app);
  return app;
}

describe('session routes', () => {
  test('list own sessions', async () => {
    const app = makeApp();
    const res = await request(app)
      .get('/api/sessions')
      .set('Authorization', 'Bearer token');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(2);
  });

  test('list others forbidden', async () => {
    const app = makeApp();
    const res = await request(app)
      .get('/api/sessions')
      .query({ userId: 'u2' })
      .set('Authorization', 'Bearer token');
    expect(res.status).toBe(403);
  });

  test('admin list others', async () => {
    Object.assign(jwtPayload, { sub: 'admin', jti: 'a', roles: ['admin'] });
    const app = makeApp();
    const res = await request(app)
      .get('/api/sessions')
      .query({ userId: 'u2' })
      .set('Authorization', 'Bearer token');
    expect(res.status).toBe(200);
    expect(res.body.data[0].jti).toBe('s3');
  });

  test('delete own active session', async () => {
    const app = makeApp();
    const res = await request(app)
      .delete('/api/sessions/s1')
      .set('Authorization', 'Bearer token');
    expect(res.status).toBe(204);
    expect(redisStore.get('jwt:blacklist:s1')).toBe('revoked');
    expect(sessions.find(s => s.jti === 's1')!.revoked).toBe(true);
  });

  test('delete already revoked session', async () => {
    const app = makeApp();
    const res = await request(app)
      .delete('/api/sessions/s2')
      .set('Authorization', 'Bearer token');
    expect(res.status).toBe(204);
    expect(redisStore.has('jwt:blacklist:s2')).toBe(false);
  });

  test('delete others session forbidden', async () => {
    const app = makeApp();
    const res = await request(app)
      .delete('/api/sessions/s3')
      .set('Authorization', 'Bearer token');
    expect(res.status).toBe(403);
  });

  test('auth missing', async () => {
    const app = makeApp();
    const res = await request(app)
      .get('/api/sessions');
    expect(res.status).toBe(401);
  });
});
