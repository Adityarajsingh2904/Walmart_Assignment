import { LedgerContract } from '../src/ledger_contract'
import { createHash } from 'crypto'

class MockStub {
  private store = new Map<string, Buffer>()
  async putState(key: string, value: Buffer) { this.store.set(key, Buffer.from(value)) }
  async getState(key: string) { return this.store.get(key) ?? Buffer.alloc(0) }
  async getStateByRange(_s: string, _e: string): Promise<AsyncIterable<{key: string; value: Buffer}>> {
    const entries = Array.from(this.store.entries()).map(([key, value]) => ({ key, value }))
    return {
      async *[Symbol.asyncIterator]() {
        for (const e of entries) {
          yield e
        }
      }
    }
  }
}

describe('LedgerContract', () => {
  const contract = new LedgerContract()
  let ctx: any

  beforeEach(() => {
    ctx = { stub: new MockStub() }
  })

  it('logs event', async () => {
    const event = {
      runId: '11111111-1111-1111-1111-111111111111',
      stepId: 'isolate',
      timestamp: '2025-07-06T12:00:00.000Z',
      action: 'isolate_host',
      status: 'success'
    }
    const key = await contract.LogEvent(ctx, JSON.stringify(event))
    const stored = await ctx.stub.getState(key)
    expect(stored.toString()).toContain('isolate_host')
  })

  it('verifies hash', async () => {
    const event = { runId: '1', timestamp: 't' }
    const key = await contract.LogEvent(ctx, JSON.stringify(event))
    const data = await ctx.stub.getState(key)
    const hash = createHash('sha256').update(data).digest('hex')
    const res = await contract.VerifyHash(ctx, key, hash)
    expect(res.valid).toBe(true)
  })

  it('exports csv', async () => {
    const event = { runId: '1', timestamp: 't' }
    const key = await contract.LogEvent(ctx, JSON.stringify(event))
    const csv = await contract.ExportCSV(ctx)
    expect(csv).toContain('id,timestamp,logJson,hash')
    expect(csv).toContain(key)
  })
})
