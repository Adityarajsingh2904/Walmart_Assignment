import { decodeProtectedHeader } from 'jose';
import { randomUUID } from 'crypto';

let issueJwt: any;
let validateJwt: any;
let rotateKeys: any;
let revokeToken: any;
let sign: any;
let verify: any;

const redisStore = new Map<string, string>();
const keys: any[] = [{ id: 'k1', secret: 's1', active: true }];
const sent: any[] = [];

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    get: jest.fn((k: string) => Promise.resolve(redisStore.get(k) ?? null)),
    set: jest.fn((k: string, v: string, _m: string, _ex: number, ttl: number) => {
      redisStore.set(k, v); return Promise.resolve('OK');
    }),
  }));
});

jest.mock('@aws-sdk/client-kms', () => {
  return {
    KMSClient: jest.fn().mockImplementation(() => ({ send: jest.fn(async (cmd: any) => ({ Plaintext: cmd.CiphertextBlob })) })),
    DecryptCommand: jest.fn().mockImplementation((input: any) => input),
  };
});

jest.mock('kafkajs', () => {
  return {
    Kafka: jest.fn().mockImplementation(() => ({
      producer: jest.fn(() => ({
        connect: jest.fn(() => Promise.resolve()),
        send: jest.fn((msg: any) => { sent.push(msg); return Promise.resolve(); }),
        disconnect: jest.fn(() => Promise.resolve()),
      }))
    }))
  };
});

jest.mock('@prisma/client', () => {
  return {
    PrismaClient: jest.fn().mockImplementation(() => ({
      jwt_keys: {
        findFirst: jest.fn(() => Promise.resolve(keys.find(k => k.active))),
        findUnique: jest.fn(({ where: { id } }: any) => Promise.resolve(keys.find(k => k.id === id) || null)),
        create: jest.fn(({ data }: any) => { const k = { id: randomUUID(), ...data }; keys.push(k); return Promise.resolve(k); }),
        update: jest.fn(({ where: { id }, data }: any) => { const k = keys.find(k => k.id === id)!; Object.assign(k, data); return Promise.resolve(k); })
      }
    }))
  };
});

beforeEach(async () => {
  jest.resetModules();
  redisStore.clear();
  sent.length = 0;
  ({ issueJwt, validateJwt, rotateKeys, revokeToken, sign, verify } = await import('../src/lib/jwt'));
});

test('issue and validate success', async () => {
  const { access } = await issueJwt('u1', ['r'], { a: '1' }, 't1');
  const res = await validateJwt(access);
  expect(res.valid).toBe(true);
  if (res.valid) {
    expect(res.payload.sub).toBe('u1');
    expect(res.payload.roles).toEqual(['r']);
  }
});

test('blacklisted jti denied', async () => {
  const { access } = await issueJwt('u1', [], {}, 't1');
  const { payload } = (await validateJwt(access)) as any;
  redisStore.set(`jwt:blacklist:${payload.jti}`, '1');
  const res = await validateJwt(access);
  expect(res.valid).toBe(false);
});

test('expired token denied', async () => {
  const { access } = await issueJwt('u1', [], {}, 't1');
  const header = decodeProtectedHeader(access);
  const secret = new TextEncoder().encode('s1');
  const past = Math.floor(Date.now() / 1000) - 60;
  const token = await new (require('jose').SignJWT)({ sub: 'u1', jti: 'x', roles: [], attrs: {}, tenant_id: 't1' })
    .setProtectedHeader({ alg: 'HS256', kid: header.kid })
    .setIssuedAt(past)
    .setExpirationTime(past)
    .sign(secret);
  const res = await validateJwt(token);
  expect(res.valid).toBe(false);
});

test('wrong signature denied', async () => {
  const { access } = await issueJwt('u1', [], {}, 't1');
  const header = decodeProtectedHeader(access);
  const secret = new TextEncoder().encode('wrong');
  const { SignJWT } = require('jose');
  const now = Math.floor(Date.now() / 1000);
  const bad = await new SignJWT({ sub: 'u1', jti: 'bad', roles: [], attrs: {}, tenant_id: 't1' })
    .setProtectedHeader({ alg: 'HS256', kid: header.kid })
    .setIssuedAt(now)
    .setExpirationTime(now + 60)
    .sign(secret);
  const res = await validateJwt(bad);
  expect(res.valid).toBe(false);
});

test('key rotation preserves old tokens', async () => {
  const { access } = await issueJwt('u1', [], {}, 't1');
  const kidOld = decodeProtectedHeader(access).kid;
  await rotateKeys();
  const resOld = await validateJwt(access);
  expect(resOld.valid).toBe(true);
  const { access: newT } = await issueJwt('u1', [], {}, 't1');
  const kidNew = decodeProtectedHeader(newT).kid;
  expect(kidNew).not.toBe(kidOld);
  expect(sent.length).toBe(1);
});

test('concurrent issue/validate', async () => {
  await Promise.all(
    Array.from({ length: 10 }).map(async () => {
      const { access } = await issueJwt('u1', ['r'], {}, 't1');
      const v = await validateJwt(access);
      expect(v.valid).toBe(true);
    })
  );
});

test('sign/verify with encrypted key', async () => {
  keys[0].secret = 'enc:' + Buffer.from('s1').toString('base64');
  const t = await sign({ sub: 'u1' });
  const payload = await verify(t);
  expect(payload.sub).toBe('u1');
});

test('revokeToken stores blacklist', async () => {
  await revokeToken('j1', 60);
  expect(redisStore.get('jwt:blacklist:j1')).toBe('1');
});

test('attachJwt middleware', async () => {
  const app = require('express')();
  const { access } = await issueJwt('u2', [], {}, 't1');
  const { attachJwt } = await import('../src/lib/jwt');
  attachJwt(app);
  app.get('/p', (req: any, res: any) => res.json(req.user));
  const res = await require('supertest')(app).get('/p').set('Authorization', `Bearer ${access}`);
  expect(res.status).toBe(200);
  expect(res.body.sub).toBe('u2');
});

test('db fetch path used when cache empty', async () => {
  const { sign } = await import('../src/lib/jwt');
  const t = await sign({ sub: 'u3' });
  jest.resetModules();
  const { validateJwt: v } = await import('../src/lib/jwt');
  const res = await v(t);
  expect(res.valid).toBe(true);
});
