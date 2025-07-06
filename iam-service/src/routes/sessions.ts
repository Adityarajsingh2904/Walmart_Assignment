import express, { Express, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { z } from 'zod';
import { Counter } from 'prom-client';
import { logger } from 'structlog';
import { attachAuthz } from '../middleware/authz';

const prisma = new PrismaClient();

const sessionRevoked = new Counter({
  name: 'session_revoked_total',
  help: 'Total sessions revoked',
});

const querySchema = z.object({
  userId: z.string().optional(),
  page: z.string().optional(),
  pageSize: z
    .preprocess((v) => (v === undefined ? undefined : Number(v)), z.number().int().min(1).max(100))
    .optional()
    .default(20),
});

/**
 * @openapi
 * /sessions:
 *   get:
 *     tags: [Sessions]
 *     responses:
 *       200: {}
 *       400: {}
 *       403: {}
 *       401: {}
 */
async function listSessions(req: Request, res: Response) {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Bad Request' });
  }

  const { userId, page, pageSize } = parsed.data;
  const auth = (req as any).user || {};
  const target = userId || auth.sub;
  const isAdmin = Array.isArray(auth.roles) && auth.roles.includes('admin');

  if (!isAdmin && target !== auth.sub) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const where: any = { user_id: target };
  if (page) {
    const d = new Date(page);
    if (isNaN(d.getTime())) return res.status(400).json({ error: 'Bad Request' });
    where.created_at = { lt: d };
  }

  const list = await prisma.sessions.findMany({
    where,
    orderBy: { created_at: 'desc' },
    take: pageSize + 1,
  });

  const next = list.length > pageSize ? list[pageSize].created_at.toISOString() : null;
  const data = list.slice(0, pageSize).map((s: any) => ({
    jti: s.jti,
    ip: s.ip,
    device: s.ua,
    created_at: s.created_at.toISOString(),
    last_seen: s.last_seen ? new Date(s.last_seen).toISOString() : null,
    revoked: !!s.revoked,
  }));

  res.json({ data, next });
}

/**
 * @openapi
 * /sessions/{jti}:
 *   delete:
 *     tags: [Sessions]
 *     responses:
 *       204: {}
 *       403: {}
 *       404: {}
 *       401: {}
 */
async function deleteSession(req: Request, res: Response) {
  const { jti } = req.params;
  if (!jti) return res.status(400).json({ error: 'Bad Request' });

  const session = await prisma.sessions.findUnique({ where: { jti } });
  if (!session) return res.status(404).end();

  const auth = (req as any).user || {};
  const isAdmin = Array.isArray(auth.roles) && auth.roles.includes('admin');
  if (!isAdmin && auth.sub !== session.user_id) {
    return res.status(403).end();
  }

  if (!session.revoked) {
    const redis: Redis = req.app.locals.redis;
    await redis.setex(`jwt:blacklist:${jti}`, 900, 'revoked');
    await prisma.sessions.update({ where: { jti }, data: { revoked: true, revoked_at: new Date() } });
    sessionRevoked.inc();
    logger.info('session_revoked', { action: 'revoke', jti, user_id: session.user_id, by: auth.sub });
  }

  res.status(204).end();
}

export function mountSessionRoutes(app: Express) {
  const router = express.Router();

  router.use((req, res, next) => {
    if (!req.headers.authorization) return res.status(401).json({ error: 'Unauthorized' });
    next();
  });
  attachAuthz(router as unknown as Express);

  router.get('/sessions', listSessions);
  router.delete('/sessions/:jti', deleteSession);

  app.use('/api', router);
}

