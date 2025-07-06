import { Context, Contract, Info, Returns, Transaction } from 'fabric-contract-api'
import { createHash } from 'crypto'
import { stringify } from 'csv-stringify/sync'

@Info({ title: 'LedgerContract', description: 'Security event logging' })
export class LedgerContract extends Contract {
  @Transaction()
  public async LogEvent(ctx: Context, logJson: string): Promise<string> {
    const evt = JSON.parse(logJson)
    const key = evt.runId
    const timestamp = evt.timestamp
    if (!key || !timestamp) throw new Error('logJson must contain runId and timestamp')
    const ledgerKey = createHash('sha256').update(`${key}|${timestamp}`).digest('hex')
    await ctx.stub.putState(ledgerKey, Buffer.from(logJson))
    return ledgerKey
  }

  @Transaction(false)
  @Returns('object')
  public async VerifyHash(ctx: Context, key: string, providedHash: string): Promise<{ valid: boolean; ledgerHash: string; providedHash: string }> {
    const data = await ctx.stub.getState(key)
    if (!data || data.length === 0) throw new Error(`No record for key ${key}`)
    const ledgerHash = createHash('sha256').update(data).digest('hex')
    return { valid: ledgerHash === providedHash, ledgerHash, providedHash }
  }

  @Transaction(false)
  public async ExportCSV(ctx: Context): Promise<string> {
    const iterator = (await ctx.stub.getStateByRange('', '')) as unknown as AsyncIterable<{key:string,value:Buffer}>
    const rows: string[][] = []
    for await (const res of iterator) {
      const value = res.value.toString()
      const evt = JSON.parse(value)
      const timestamp = evt.timestamp || ''
      const hash = createHash('sha256').update(value).digest('hex')
      rows.push([res.key, timestamp, value, hash])
    }
    return stringify(rows, { header: true, columns: ['id', 'timestamp', 'logJson', 'hash'] })
  }
}
