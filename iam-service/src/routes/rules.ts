import express, { Express, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { apply } from 'json-logic-js';

const prisma = new PrismaClient();

const createSchema = z.object({
  name: z.string(),
  target: z.string(),
  json_logic: z.any(),
});

const updateSchema = createSchema.partial();

const querySchema = z.object({
  search: z.string().optional(),
  cursor: z.string().optional(),
  limit: z
    .preprocess((v) => (v === undefined ? 20 : Number(v)), z.number().int().min(1).max(100))
    .optional()
    .default(20),
});

function validateLogic(rule: any): boolean {
  try {
    apply(rule, {});
    return true;
  } catch (_) {
    return false;
  }
}

async function listRules(req: Request, res: Response) {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: 'Bad Request' });

  const auth: any = (req as any).user || {};
  const isAdmin = Array.isArray(auth.roles) && auth.roles.includes('admin');
  const perms: string[] = auth.permissions || [];
  if (!isAdmin && !perms.includes('iam:rules:read')) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { search, cursor, limit } = parsed.data;
  const where: any = { deleted_at: null };
  if (search) where.name = { contains: search, mode: 'insensitive' };
  if (cursor) where.id = { gt: cursor };

  const list = await prisma.abacRule.findMany({
    where,
    orderBy: { id: 'asc' },
    take: limit + 1,
  });
  const next = list.length > limit ? list[limit].id : null;
  const data = list.slice(0, limit).map((r: any) => ({
    id: r.id,
    name: r.name,
    target: r.target,
    json_logic: r.json_logic,
    created_at: r.created_at.toISOString(),
  }));
  res.json({ success: true, data: { items: data, next } });
}

async function createRule(req: Request, res: Response) {
  const auth: any = (req as any).user || {};
  if (!Array.isArray(auth.roles) || !auth.roles.includes('admin')) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success || !validateLogic(parsed.data.json_logic)) {
    return res.status(400).json({ error: 'Bad Request' });
  }
  const rule = await prisma.abacRule.create({ data: parsed.data });
  await req.app.locals.kafka?.publish('rule.updated', JSON.stringify(rule));
  res.json({ success: true, data: { ...rule, created_at: rule.created_at.toISOString() } });
}

async function updateRule(req: Request, res: Response) {
  const auth: any = (req as any).user || {};
  if (!Array.isArray(auth.roles) || !auth.roles.includes('admin')) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success || (parsed.data.json_logic && !validateLogic(parsed.data.json_logic))) {
    return res.status(400).json({ error: 'Bad Request' });
  }
  const id = req.params.id;
  const rule = await prisma.abacRule.update({ where: { id }, data: parsed.data });
  await req.app.locals.kafka?.publish('rule.updated', JSON.stringify(rule));
  res.json({ success: true, data: { ...rule, created_at: rule.created_at.toISOString() } });
}

async function deleteRule(req: Request, res: Response) {
  const auth: any = (req as any).user || {};
  if (!Array.isArray(auth.roles) || !auth.roles.includes('admin')) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const id = req.params.id;
  await prisma.abacRule.update({ where: { id }, data: { deleted_at: new Date() } });
  await req.app.locals.kafka?.publish('rule.updated', JSON.stringify({ id, deleted: true }));
  res.status(204).end();
}

export function mountRuleRoutes(app: Express) {
  const router = express.Router();
  router.get('/rules', listRules);
  router.post('/rules', createRule);
  router.patch('/rules/:id', updateRule);
  router.delete('/rules/:id', deleteRule);
  app.use('/api', router);
}

export default mountRuleRoutes;
