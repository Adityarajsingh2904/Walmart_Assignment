import express, { Express, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

const createSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  permissions: z.array(z.string()),
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

async function listRoles(req: Request, res: Response) {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: 'Bad Request' });

  const auth: any = (req as any).user || {};
  const isAdmin = Array.isArray(auth.roles) && auth.roles.includes('admin');
  const perms: string[] = auth.permissions || [];
  if (!isAdmin && !perms.includes('iam:roles:read')) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { search, cursor, limit } = parsed.data;
  const where: any = { deleted_at: null };
  if (search) where.name = { contains: search, mode: 'insensitive' };
  if (cursor) where.id = { gt: cursor };

  const list = await prisma.role.findMany({
    where,
    orderBy: { id: 'asc' },
    take: limit + 1,
  });
  const next = list.length > limit ? list[limit].id : null;
  const data = list.slice(0, limit).map((r: any) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    permissions: r.permissions,
    created_at: r.created_at.toISOString(),
  }));
  res.json({ success: true, data: { items: data, next } });
}

async function createRole(req: Request, res: Response) {
  const auth: any = (req as any).user || {};
  if (!Array.isArray(auth.roles) || !auth.roles.includes('admin')) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Bad Request' });
  const role = await prisma.role.create({ data: parsed.data });
  await req.app.locals.kafka?.publish('role.updated', JSON.stringify(role));
  res.json({ success: true, data: { ...role, created_at: role.created_at.toISOString() } });
}

async function updateRole(req: Request, res: Response) {
  const auth: any = (req as any).user || {};
  if (!Array.isArray(auth.roles) || !auth.roles.includes('admin')) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Bad Request' });
  const id = req.params.id;
  const role = await prisma.role.update({ where: { id }, data: parsed.data });
  await req.app.locals.kafka?.publish('role.updated', JSON.stringify(role));
  res.json({ success: true, data: { ...role, created_at: role.created_at.toISOString() } });
}

async function deleteRole(req: Request, res: Response) {
  const auth: any = (req as any).user || {};
  if (!Array.isArray(auth.roles) || !auth.roles.includes('admin')) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const id = req.params.id;
  await prisma.role.update({ where: { id }, data: { deleted_at: new Date() } });
  await req.app.locals.kafka?.publish('role.updated', JSON.stringify({ id, deleted: true }));
  res.status(204).end();
}

export function mountRoleRoutes(app: Express) {
  const router = express.Router();
  router.get('/roles', listRoles);
  router.post('/roles', createRole);
  router.patch('/roles/:id', updateRole);
  router.delete('/roles/:id', deleteRole);
  app.use('/api', router);
}

export default mountRoleRoutes;
