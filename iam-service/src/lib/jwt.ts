import { SignJWT, jwtVerify, decodeProtectedHeader, JWTPayload } from 'jose';
import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { Kafka } from 'kafkajs';
import { KMSClient, DecryptCommand } from '@aws-sdk/client-kms';
import type { Express, Request, Response, NextFunction } from 'express';

export interface JwtPayload extends JWTPayload {
  sub: string;
  jti: string;
  roles: string[];
  attrs: Record<string, string>;
  tenant_id: string;
}

const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_DSN || '');
const kafka = new Kafka({ brokers: (process.env.KAFKA_BOOTSTRAP_SERVERS || 'localhost:9092').split(',') });
const kms = new KMSClient({});

interface CachedKey { secret: Uint8Array; expires: number; }
const keyCache = new Map<string, CachedKey>();
let activeKey: { id: string; secret: Uint8Array; expires: number } | null = null;

async function decryptSecret(secret: string): Promise<string> {
  if (!secret.startsWith('enc:')) return secret;
  const cipher = Buffer.from(secret.slice(4), 'base64');
  const out = await kms.send(new DecryptCommand({ CiphertextBlob: cipher, KeyId: process.env.AWS_KMS_KEY_ID }));
  return Buffer.from(out.Plaintext ?? '').toString('utf-8');
}

async function fetchKey(id: string): Promise<Uint8Array> {
  const cached = keyCache.get(id);
  if (cached && cached.expires > Date.now()) return cached.secret;
  const row = await prisma.jwt_keys.findUnique({ where: { id } });
  if (!row) throw new Error('key_not_found');
  const secret = new TextEncoder().encode(await decryptSecret(row.secret));
  keyCache.set(id, { secret, expires: Date.now() + 5 * 60_000 });
  return secret;
}

async function fetchActiveKey(): Promise<{ id: string; secret: Uint8Array }> {
  if (activeKey && activeKey.expires > Date.now()) return activeKey;
  const row = await prisma.jwt_keys.findFirst({ where: { active: true } });
  if (!row) throw new Error('no_active_key');
  const secret = new TextEncoder().encode(await decryptSecret(row.secret));
  activeKey = { id: row.id, secret, expires: Date.now() + 5 * 60_000 };
  keyCache.set(row.id, { secret, expires: Date.now() + 5 * 60_000 });
  return activeKey;
}

export async function sign(payload: JWTPayload): Promise<string> {
  const { id, secret } = await fetchActiveKey();
  const now = Math.floor(Date.now() / 1000);
  const p = { iat: now, jti: randomUUID(), ...payload };
  return new SignJWT(p).setProtectedHeader({ alg: 'HS256', kid: id }).sign(secret);
}

export async function verify(token: string): Promise<JwtPayload> {
  const res = await validateJwt(token);
  if (!res.valid) throw new Error(res.error);
  return res.payload;
}

export async function issueJwt(
  userId: string,
  roles: string[],
  attrs: Record<string, string>,
  tenantId: string,
): Promise<{ access: string; refresh: string }> {
  const { id, secret } = await fetchActiveKey();
  const now = Math.floor(Date.now() / 1000);
  const accessExp = now + 15 * 60;
  const refreshExp = now + 30 * 24 * 60 * 60;

  const base = { sub: userId, roles, attrs, tenant_id: tenantId };
  const access = await new SignJWT({ ...base, jti: randomUUID() })
    .setProtectedHeader({ alg: 'HS256', kid: id })
    .setIssuedAt(now)
    .setExpirationTime(accessExp)
    .sign(secret);

  const refresh = await new SignJWT({ ...base, jti: randomUUID() })
    .setProtectedHeader({ alg: 'HS256', kid: id })
    .setIssuedAt(now)
    .setExpirationTime(refreshExp)
    .sign(secret);

  return { access, refresh };
}

export async function validateJwt(
  token: string,
): Promise<{ valid: true; payload: JwtPayload } | { valid: false; error: string }> {
  try {
    const header = decodeProtectedHeader(token);
    if (!header.kid || typeof header.kid !== 'string') return { valid: false, error: 'kid_missing' };
    const secret = await fetchKey(header.kid);
    const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] });
    const jti = payload.jti as string;
    if (!jti) return { valid: false, error: 'jti_missing' };
    const blacklisted = await redis.get(`jwt:blacklist:${jti}`);
    if (blacklisted) return { valid: false, error: 'revoked' };
    return { valid: true, payload: payload as JwtPayload };
  } catch (e: any) {
    return { valid: false, error: 'invalid' };
  }
}

export function attachJwt(app: Express): void {
  app.use(async (req: Request, res: Response, next: NextFunction) => {
    const auth = req.headers['authorization'];
    if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'unauthorized' });
    const token = auth.slice(7);
    const result = await validateJwt(token);
    if (!result.valid) return res.status(401).json({ error: 'unauthorized' });
    (req as any).user = result.payload;
    next();
  });
}

export async function rotateKeys(): Promise<void> {
  const old = await prisma.jwt_keys.findFirst({ where: { active: true } });
  const secret = randomUUID();
  const newKey = await prisma.jwt_keys.create({ data: { secret, active: true } });
  if (old) await prisma.jwt_keys.update({ where: { id: old.id }, data: { active: false } });
  activeKey = null;
  keyCache.set(newKey.id, { secret: new TextEncoder().encode(secret), expires: Date.now() + 5 * 60_000 });
  const producer = kafka.producer();
  await producer.connect();
  await producer.send({ topic: 'jwt_key_rotated', messages: [{ value: JSON.stringify({ kid: newKey.id }) }] });
  await producer.disconnect();
}

export async function revokeToken(jti: string, ttl: number): Promise<void> {
  if (ttl <= 0) return;
  await redis.set(`jwt:blacklist:${jti}`, '1', 'EX', ttl);
}

export default {
  sign,
  verify,
  issueJwt,
  validateJwt,
  attachJwt,
  rotateKeys,
  revokeToken,
};
