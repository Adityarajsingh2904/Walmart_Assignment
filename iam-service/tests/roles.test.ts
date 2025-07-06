import request from 'supertest';
import express from 'express';

let mountRoleRoutes: any;
const roles: any[] = [];
const published: any[] = [];

jest.mock('@prisma/client', () => {
  return {
    PrismaClient: jest.fn().mockImplementation(() => ({
      role: {
        create: jest.fn(({ data }: any) => {
          const r = { id: `r${roles.length + 1}`, created_at: new Date('2025-01-01T00:00:00Z'), deleted_at: null, ...data };
          roles.push(r);
          return Promise.resolve(r);
        }),
        update: jest.fn(({ where: { id }, data }: any) => {
          const r = roles.find((x) => x.id === id)!;
          Object.assign(r, data);
          return Promise.resolve(r);
        }),
        findMany: jest.fn(({ where }: any) => {
          let list = roles.filter((r) => r.deleted_at === null);
          if (where?.name?.contains) {
            list = list.filter((r) => r.name.includes(where.name.contains));
          }
          if (where?.id?.gt) {
            list = list.filter((r) => r.id > where.id.gt);
          }
          return Promise.resolve(list);
        }),
      },
    })),
  };
});

beforeEach(async () => {
  jest.resetModules();
  roles.length = 0;
  published.length = 0;
  ({ mountRoleRoutes } = await import('../src/routes/roles'));
});

function makeApp(user: any = { roles: ['admin'], permissions: [] }) {
  const app = express();
  app.use(express.json());
  app.locals.kafka = { publish: (t: string, p: string) => published.push({ t, p }) };
  app.use((req, _res, next) => {
    (req as any).user = user;
    next();
  });
  mountRoleRoutes(app);
  return app;
}

test('create role', async () => {
  const app = makeApp();
  const res = await request(app).post('/api/roles').send({ name: 'test', permissions: [] });
  expect(res.status).toBe(200);
  expect(roles.length).toBe(1);
  expect(published.length).toBe(1);
});

test('list roles', async () => {
  roles.push({ id: 'r1', name: 't1', permissions: [], deleted_at: null, created_at: new Date('2025-01-01T00:00:00Z') });
  const app = makeApp({ roles: [], permissions: ['iam:roles:read'] });
  const res = await request(app).get('/api/roles');
  expect(res.status).toBe(200);
  expect(res.body.data.items.length).toBe(1);
});

test('delete role', async () => {
  roles.push({ id: 'r1', name: 't1', permissions: [], deleted_at: null, created_at: new Date('2025-01-01T00:00:00Z') });
  const app = makeApp();
  const res = await request(app).delete('/api/roles/r1');
  expect(res.status).toBe(204);
  expect(roles[0].deleted_at).not.toBeNull();
});
