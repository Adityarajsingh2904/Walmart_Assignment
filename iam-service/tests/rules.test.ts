import request from 'supertest';
import express from 'express';

let mountRuleRoutes: any;
const rules: any[] = [];
const published: any[] = [];

jest.mock('@prisma/client', () => {
  return {
    PrismaClient: jest.fn().mockImplementation(() => ({
      abacRule: {
        create: jest.fn(({ data }: any) => {
          const r = { id: `a${rules.length + 1}`, created_at: new Date('2025-01-01T00:00:00Z'), deleted_at: null, ...data };
          rules.push(r);
          return Promise.resolve(r);
        }),
        update: jest.fn(({ where: { id }, data }: any) => {
          const r = rules.find((x) => x.id === id)!;
          Object.assign(r, data);
          return Promise.resolve(r);
        }),
        findMany: jest.fn(({ where }: any) => {
          let list = rules.filter((r) => r.deleted_at === null);
          if (where?.name?.contains) list = list.filter((r) => r.name.includes(where.name.contains));
          if (where?.id?.gt) list = list.filter((r) => r.id > where.id.gt);
          return Promise.resolve(list);
        }),
      },
    })),
  };
});

jest.mock('json-logic-js', () => ({ apply: jest.fn(() => true) }), { virtual: true });

beforeEach(async () => {
  jest.resetModules();
  rules.length = 0;
  published.length = 0;
  ({ mountRuleRoutes } = await import('../src/routes/rules'));
});

function makeApp(user: any = { roles: ['admin'], permissions: [] }) {
  const app = express();
  app.use(express.json());
  app.locals.kafka = { publish: (t: string, p: string) => published.push({ t, p }) };
  app.use((req, _res, next) => { (req as any).user = user; next(); });
  mountRuleRoutes(app);
  return app;
}

test('create rule', async () => {
  const app = makeApp();
  const res = await request(app).post('/api/rules').send({ name: 'r', target: 't', json_logic: {} });
  expect(res.status).toBe(200);
  expect(rules.length).toBe(1);
  expect(published.length).toBe(1);
});

test('invalid logic', async () => {
  const app = makeApp();
  // mock apply to throw
  const logic = require('json-logic-js');
  logic.apply.mockImplementation(() => { throw new Error('bad'); });
  const res = await request(app).post('/api/rules').send({ name: 'r', target: 't', json_logic: {} });
  expect(res.status).toBe(400);
});

test('list rules requires read perm', async () => {
  rules.push({ id: 'a1', name: 'r', target: 't', json_logic: {}, deleted_at: null, created_at: new Date('2025-01-01T00:00:00Z') });
  const app = makeApp({ roles: [], permissions: ['iam:rules:read'] });
  const res = await request(app).get('/api/rules');
  expect(res.status).toBe(200);
  expect(res.body.data.items.length).toBe(1);
});
