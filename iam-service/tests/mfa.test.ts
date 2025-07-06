import Fastify from 'fastify';
import * as speakeasy from 'speakeasy';

let plugin: any;
let prisma: any;
let redisStore: Map<string, string>;

const users: any[] = [
  { id: 'u1', email: 'e@test', phone: '+10000000000', preferred_mfa: 'email' },
];
const devices: any[] = [];
const challenges: any[] = [];
const bindings: any[] = [{ user_id: 'u1', role: { name: 'user' } }];

jest.mock('@prisma/client', () => {
  return {
    PrismaClient: jest.fn().mockImplementation(() => {
      prisma = {
        user_devices: {
          findMany: jest.fn(({ where }: any) => devices.filter(d => d.user_id === where.user_id)),
        },
        users: {
          findUnique: jest.fn(({ where }: any) => users.find(u => u.id === where.id) || null),
        },
        mfa_challenges: {
          create: jest.fn(({ data }: any) => { challenges.push({ ...data }); return Promise.resolve(data); }),
          findUnique: jest.fn(({ where }: any) => challenges.find(c => c.uuid === where.uuid) || null),
          update: jest.fn(({ where, data }: any) => { const c = challenges.find(ch => ch.uuid === where.uuid); Object.assign(c, data); return c; }),
        },
        role_bindings: {
          findMany: jest.fn(({ where }: any) => bindings.filter(b => b.user_id === where.user_id)),
        },
      };
      return prisma;
    }),
  };
});

redisStore = new Map();
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    get: jest.fn((k: string) => Promise.resolve(redisStore.get(k) ?? null)),
    set: jest.fn((k: string, v: string) => { redisStore.set(k, v); return Promise.resolve('OK'); }),
    del: jest.fn((k: string) => { redisStore.delete(k); return Promise.resolve(1); }),
  }));
});

jest.mock('node-fetch', () => jest.fn(() => Promise.resolve({ ok: true })), { virtual: true });

const secrets: Record<string, string> = {
  SENDGRID_API_KEY: 'sg',
  TWILIO_ACCOUNT_SID: 'sid',
  TWILIO_AUTH_TOKEN: 'token',
  TWILIO_FROM: '+1',
};

jest.mock('@aws-sdk/client-secrets-manager', () => {
  return {
    SecretsManagerClient: jest.fn().mockImplementation(() => ({
      send: jest.fn((cmd: any) => Promise.resolve({ SecretString: secrets[cmd.input.SecretId] })),
    })),
    GetSecretValueCommand: jest.fn().mockImplementation((input: any) => ({ input })),
  };
});

const jwt = { sign: jest.fn(() => Promise.resolve('signed')) };
jest.mock('@trustvault/jwt', () => jwt, { virtual: true });

describe('mfa routes', () => {
  beforeEach(async () => {
    jest.resetModules();
    ({ default: plugin } = await import('../src/routes/mfa'));
    devices.length = 0;
    challenges.length = 0;
    redisStore.clear();
    jwt.sign.mockClear();
  });

  test('challenge generated (risk high)', async () => {
    const app = Fastify();
    await app.register(plugin);
    const res = await app.inject({
      method: 'POST',
      url: '/mfa/evaluate',
      payload: { jti: 'j', user_id: 'u1', risk_score: 70, device_id: 'd1' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.mfa_required).toBe(true);
    expect(challenges.length).toBe(1);
    expect(redisStore.has(`mfa:${body.challenge_uuid}`)).toBe(true);
  });

  test('challenge generated (new device)', async () => {
    const app = Fastify();
    await app.register(plugin);
    devices.push({ user_id: 'u1', device_id: 'known' });
    const res = await app.inject({
      method: 'POST',
      url: '/mfa/evaluate',
      payload: { jti: 'j', user_id: 'u1', risk_score: 10, device_id: 'new' },
    });
    expect(res.json().mfa_required).toBe(true);
  });

  test('no challenge (low risk known device)', async () => {
    const app = Fastify();
    await app.register(plugin);
    devices.push({ user_id: 'u1', device_id: 'd1' });
    const res = await app.inject({
      method: 'POST',
      url: '/mfa/evaluate',
      payload: { jti: 'j', user_id: 'u1', risk_score: 20, device_id: 'd1' },
    });
    expect(res.json()).toEqual({ mfa_required: false });
  });

  test('successful verify', async () => {
    const app = Fastify();
    await app.register(plugin);
    const evalRes = await app.inject({
      method: 'POST',
      url: '/mfa/evaluate',
      payload: { jti: 'j', user_id: 'u1', risk_score: 70, device_id: 'd1' },
    });
    const { challenge_uuid } = evalRes.json();
    const secret = challenges[0].secret_base32;
    const code = speakeasy.totp({ secret, encoding: 'base32' });
    const verifyRes = await app.inject({
      method: 'POST',
      url: '/mfa/verify',
      payload: { challenge_uuid, code },
    });
    expect(verifyRes.statusCode).toBe(200);
    expect(verifyRes.json()).toEqual({ token: 'signed' });
  });

  test('failed verify (wrong code)', async () => {
    const app = Fastify();
    await app.register(plugin);
    const evalRes = await app.inject({
      method: 'POST',
      url: '/mfa/evaluate',
      payload: { jti: 'j', user_id: 'u1', risk_score: 70, device_id: 'd1' },
    });
    const { challenge_uuid } = evalRes.json();
    const verifyRes = await app.inject({
      method: 'POST',
      url: '/mfa/verify',
      payload: { challenge_uuid, code: '000000' },
    });
    expect(verifyRes.statusCode).toBe(403);
  });
});
