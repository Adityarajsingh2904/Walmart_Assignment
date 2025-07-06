import { FastifyPluginAsync } from 'fastify';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { randomUUID } from 'crypto';
import * as speakeasy from 'speakeasy';
import fetch from 'node-fetch';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { Counter } from 'prom-client';
import jwt from '@trustvault/jwt';

const prisma = new PrismaClient();
const redis = new Redis();
const secrets = new SecretsManagerClient({});

export function needsMfa(ctx: { risk_score: number; device_id: string; known_devices: string[] }): boolean {
  if (ctx.risk_score >= 60) return true;
  return !ctx.known_devices.includes(ctx.device_id);
}

const challengeCounter = new Counter({
  name: 'mfa_challenge_total',
  help: 'Total MFA challenges created',
  labelNames: ['channel'] as const,
});

const failureCounter = new Counter({
  name: 'mfa_failure_total',
  help: 'Total MFA verification failures',
  labelNames: ['reason'] as const,
});

async function getSecret(name: string): Promise<string> {
  const out = await secrets.send(new GetSecretValueCommand({ SecretId: name }));
  return out.SecretString || '';
}

async function sendEmail(to: string, code: string) {
  const key = await getSecret('SENDGRID_API_KEY');
  await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: 'no-reply@example.com' },
      subject: 'MFA Code',
      content: [{ type: 'text/plain', value: `Your code is ${code}` }],
    }),
  });
}

async function sendSms(to: string, code: string) {
  const sid = await getSecret('TWILIO_ACCOUNT_SID');
  const token = await getSecret('TWILIO_AUTH_TOKEN');
  const from = await getSecret('TWILIO_FROM');
  const params = new URLSearchParams({ To: to, From: from, Body: `Your code is ${code}` });
  await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  });
}

const plugin: FastifyPluginAsync = async (app) => {
  /**
   * @openapi
   * /mfa/evaluate:
   *   post:
   *     tags: [MFA]
   *     responses:
   *       200: {}
   *       400: {}
   *       403: {}
   */
  app.post('/mfa/evaluate', async (req, reply) => {
    const { jti, user_id, risk_score, device_id } = req.body as any;
    if (typeof jti !== 'string' || typeof user_id !== 'string' || typeof device_id !== 'string' || typeof risk_score !== 'number') {
      return reply.status(400).send({ error: 'Invalid request' });
    }
    const devices = await prisma.user_devices.findMany({ where: { user_id }, select: { device_id: true } });
    const known = devices.map((d: any) => d.device_id);
    if (!needsMfa({ risk_score, device_id, known_devices: known })) {
      return { mfa_required: false };
    }
    const uuid = randomUUID();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    const secret = speakeasy.generateSecret();
    await prisma.mfa_challenges.create({
      data: { uuid, user_id, secret_base32: secret.base32, expires_at: expiresAt },
    });
    await redis.set(`mfa:${uuid}`, 'pending', 'EX', 300);
    const user = await prisma.users.findUnique({ where: { id: user_id } });
    const code = speakeasy.totp({ secret: secret.base32, encoding: 'base32' });
    if (user?.preferred_mfa === 'sms') {
      await sendSms((user as any).phone, code);
      challengeCounter.inc({ channel: 'sms' });
    } else {
      await sendEmail((user as any).email, code);
      challengeCounter.inc({ channel: 'email' });
    }
    return { mfa_required: true, challenge_uuid: uuid, expires_at: expiresAt.toISOString() };
  });

  /**
   * @openapi
   * /mfa/verify:
   *   post:
   *     tags: [MFA]
   *     responses:
   *       200: {}
   *       400: {}
   *       403: {}
   */
  app.post('/mfa/verify', async (req, reply) => {
    const { challenge_uuid, code } = req.body as any;
    if (typeof challenge_uuid !== 'string' || typeof code !== 'string') {
      return reply.status(400).send({ error: 'Invalid request' });
    }
    const cached = await redis.get(`mfa:${challenge_uuid}`);
    const challenge = await prisma.mfa_challenges.findUnique({ where: { uuid: challenge_uuid } });
    if (!cached || !challenge || challenge.expires_at < new Date() || challenge.verified_at) {
      failureCounter.inc({ reason: 'expired' });
      return reply.status(403).send({ error: 'Invalid code' });
    }
    const valid = speakeasy.totp.verify({
      secret: challenge.secret_base32,
      encoding: 'base32',
      token: code,
      window: 1,
    });
    if (!valid) {
      failureCounter.inc({ reason: 'wrong_code' });
      return reply.status(403).send({ error: 'Invalid code' });
    }
    await prisma.mfa_challenges.update({ where: { uuid: challenge_uuid }, data: { verified_at: new Date() } });
    await redis.del(`mfa:${challenge_uuid}`);
    const bindings = await prisma.role_bindings.findMany({ where: { user_id: challenge.user_id }, include: { role: true } });
    const roles = bindings.map((b: any) => b.role.name);
    const token = await jwt.sign({ sub: challenge.user_id, roles, jti: randomUUID() });
    return { token };
  });
};

export default plugin;
