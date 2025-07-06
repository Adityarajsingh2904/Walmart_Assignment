import request from 'supertest'
import app from '../../src/server'
import { logEvent, verifyIntegrity, exportCsv } from '../../src/fabricClient'

jest.mock('../../src/fabricClient')

describe('routes', () => {
  it('logs event', async () => {
    const mockLog = logEvent as jest.MockedFunction<typeof logEvent>
    mockLog.mockResolvedValueOnce('tx')
    const res = await request(app)
      .post('/ledger/log-event')
      .send({
        id: 'evt',
        runId: '11111111-1111-1111-1111-111111111111',
        playbookId: '22222222-2222-2222-2222-222222222222',
        stepId: 'isolate',
        action: 'isolate_host',
        status: 'success',
        timestamp: '2025-07-06T12:00:00.000Z'
      })
    expect(res.status).toBe(201)
    expect(mockLog).toHaveBeenCalled()
  })

  it('verifies run', async () => {
    const mockVerify = verifyIntegrity as jest.MockedFunction<typeof verifyIntegrity>
    mockVerify.mockResolvedValueOnce({ valid: true, ledgerHash: 'a', providedHash: 'a' })
    const res = await request(app).get('/ledger/verify/key?hash=a')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ key: 'key', valid: true, ledgerHash: 'a', providedHash: 'a' })
    expect(mockVerify).toHaveBeenCalledWith('key', 'a')
  })

  it('exports csv', async () => {
    const mockExport = exportCsv as jest.MockedFunction<typeof exportCsv>
    const { Readable } = require('stream')
    mockExport.mockResolvedValueOnce(Readable.from(['a,b']))
    const res = await request(app).get('/ledger/export.csv')
    expect(res.status).toBe(200)
    expect(res.text).toContain('a,b')
    expect(mockExport).toHaveBeenCalled()
  })
})
