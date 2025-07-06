import { Request, Response, NextFunction, Express } from 'express';
import { Enforcer, newEnforcer, newModelFromString } from 'casbin';
import Redis from 'ioredis';
import jwt from '@trustvault/jwt';
import { PrismaClient } from '@prisma/client';
import { apply } from 'json-logic-js';
import { Counter, Registry } from 'prom-client';

const redis = new Redis();
const prisma = new PrismaClient();

const authzDenied = new Counter({
  name: 'authz_denied_total',
  help: 'Authorization denials',
  labelNames: ['reason'] as const,
});

export const registry = new Registry();
registry.registerMetric(authzDenied);

const modelText = `
[request_definition]
 r = sub, obj, act

[policy_definition]
 p = sub, obj, act

[role_definition]
 g = _, _

[policy_effect]
 e = some(where (p.eft == allow))

[matchers]
 m = g(r.sub, p.sub) && r.obj == p.obj && r.act == p.act && eval(r.obj)
`;

let enforcer: Enforcer | null = null;
async function getEnforcer() {
  if (!enforcer) {
    enforcer = await newEnforcer(newModelFromString(modelText));
  }
  return enforcer;
}

async function loadPolicies(roles: string[]) {
  const policies = await prisma.role_policies.findMany({
    where: { role: { in: roles } },
  });
  const e = await getEnforcer();
  await e.clearPolicy();
  for (const p of policies) {
    await e.addPolicy(p.role, p.path, p.method);
  }
}

async function checkAbacRules(attrs: Record<string, unknown>) {
  const rules = await prisma.attribute_rules.findMany();
  for (const rule of rules) {
    if (!apply(rule.json_logic as any, attrs)) {
      return false;
    }
  }
  return true;
}

export async function authzMiddleware(req: Request, res: Response, next: NextFunction) {
  const path = req.path;
  if (path === '/healthz') return next();
  const method = req.method.toLowerCase();
  const auth = req.headers['authorization'];
  if (!auth?.startsWith('Bearer ')) {
    authzDenied.inc({ reason: 'jwt_missing' });
    return res.status(403).json({ error: 'Forbidden', reason: 'jwt_missing' });
  }

  let payload: any;
  try {
    payload = await jwt.verify(auth.slice(7));
  } catch (e) {
    authzDenied.inc({ reason: 'jwt_invalid' });
    return res.status(403).json({ error: 'Forbidden', reason: 'jwt_invalid' });
  }

  const { sub, jti, roles = [], attrs = {} } = payload || {};
  const cacheKey = `authz:${jti}:${method}:${path}`;
  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      if (cached === 'allow') return next();
      authzDenied.inc({ reason: 'cache' });
      return res.status(403).json({ error: 'Forbidden', reason: 'cache' });
    }
  } catch (e) {
    // ignore cache errors -> default deny later
  }

  try {
    await loadPolicies(roles);
    const e = await getEnforcer();
    for (const r of roles) {
      await e.addGroupingPolicy(sub, r);
    }
    const roleAllowed = await e.enforce(sub, path, method);
    if (!roleAllowed) {
      await redis.set(cacheKey, 'deny', 'EX', 60);
      authzDenied.inc({ reason: 'rbac' });
      return res.status(403).json({ error: 'Forbidden', reason: 'rbac' });
    }
    const abacPassed = await checkAbacRules(attrs);
    if (!abacPassed) {
      await redis.set(cacheKey, 'deny', 'EX', 60);
      authzDenied.inc({ reason: 'abac' });
      return res.status(403).json({ error: 'Forbidden', reason: 'abac' });
    }
    await redis.set(cacheKey, 'allow', 'EX', 60);
    return next();
  } catch (e) {
    await redis.set(cacheKey, 'deny', 'EX', 60).catch(() => {});
    authzDenied.inc({ reason: 'rbac' });
    return res.status(403).json({ error: 'Forbidden', reason: 'rbac' });
  }
}

export function attachAuthz(app: Express) {
  app.use(authzMiddleware);
}
