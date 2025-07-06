import request from 'supertest'
import { GenericContainer, StartedTestContainer } from 'testcontainers'
import crypto from 'crypto'
import { Readable } from 'stream'

// mock fabric client with simple in-memory store
const events = new Map<string, any>()

jest.mock('../../src/fabricClient', () => ({
  logEvent: jest.fn(async (evt: any) => {
    const key = crypto.createHash('sha256').update(`${evt.runId}|${evt.timestamp}`).digest('hex')
    events.set(key, evt)
    return key
  }),
  verifyIntegrity: jest.fn(async (key: string, provided: string) => {
    const evt = events.get(key)
    const ledgerHash = crypto.createHash('sha256').update(JSON.stringify(evt)).digest('hex')
    return { valid: ledgerHash === provided, ledgerHash, providedHash: provided }
  }),
  exportCsv: jest.fn(async () => {
    let csv = 'id,timestamp,logJson,hash\n'
    for (const [k, e] of events.entries()) {
      const hash = crypto.createHash('sha256').update(JSON.stringify(e)).digest('hex')
      csv += `${k},${e.timestamp},${JSON.stringify(e)},${hash}\n`
    }
    return Readable.from([csv])
  })
}))

import app from '../../src/server'

describe('ledger service e2e', () => {
  let container: StartedTestContainer | undefined
  let dockerAvailable = true

  beforeAll(async () => {
    try {
      container = await new GenericContainer('hyperledger/fabric-peer:2.5')
        .withCmd(['sleep', '3600'])
        .start()
    } catch (err) {
      dockerAvailable = false
      console.warn('Docker not available, skipping Fabric container')
    }
  }, 60000)

  afterAll(async () => {
    if (container) await container.stop()
  })

  it('logs event, verifies integrity and exports CSV', async () => {
    if (!dockerAvailable) {
      console.warn('skipping e2e due to missing Docker')
      return
    }

    const event = {
      id: 'evt1',
      runId: '11111111-1111-1111-1111-111111111111',
      playbookId: '22222222-2222-2222-2222-222222222222',
      stepId: 'isolate',
      action: 'isolate_host',
      status: 'success',
      timestamp: '2025-07-06T12:00:00.000Z'
    }

    const postRes = await request(app).post('/ledger/log-event').send(event)
    expect([201, 202]).toContain(postRes.status)

    const key = crypto.createHash('sha256')
      .update(`${event.runId}|${event.timestamp}`)
      .digest('hex')
    const eventHash = crypto.createHash('sha256')
      .update(JSON.stringify(event))
      .digest('hex')

    const verifyRes = await request(app).get(`/ledger/verify/${key}?hash=${eventHash}`)
    expect(verifyRes.status).toBe(200)
    expect(verifyRes.body.valid).toBe(true)

    const csvRes = await request(app).get('/ledger/export.csv')
    expect(csvRes.status).toBe(200)
    const lines = csvRes.text.trim().split('\n')
    expect(lines.length).toBeGreaterThanOrEqual(2)
  })
})
