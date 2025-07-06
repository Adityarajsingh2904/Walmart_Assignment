import request from 'supertest'
import express from 'express'
import crypto from 'crypto'
import logEventHandler from '../../src/api/logEvent'
import fabric from '../../src/fabric'

jest.mock('../../src/fabric')

const invokeMock = fabric.invoke as jest.MockedFunction<typeof fabric.invoke>

const app = express()
app.use(express.json())
app.post('/log', logEventHandler)

const validEvent = {
  runId: '11111111-1111-1111-1111-111111111111',
  playbookId: '22222222-2222-2222-2222-222222222222',
  stepId: 'step1',
  action: 'act',
  status: 'success' as const,
  timestamp: '2025-01-01T00:00:00.000Z'
}

describe('logEvent api', () => {
  beforeEach(() => {
    invokeMock.mockReset().mockResolvedValue(undefined)
  })

  it('logs valid event', async () => {
    const key = crypto
      .createHash('sha256')
      .update(`${validEvent.runId}|${validEvent.stepId}|${validEvent.timestamp}`)
      .digest('hex')
    const res = await request(app).post('/log').send(validEvent)
    expect(res.status).toBe(202)
    expect(res.body).toEqual({ key })
    expect(invokeMock).toHaveBeenCalledWith('LogEvent', [key, JSON.stringify(validEvent)])
  })

  it('rejects invalid event', async () => {
    const res = await request(app).post('/log').send({})
    expect(res.status).toBe(400)
    expect(invokeMock).not.toHaveBeenCalled()
  })

  it('handles fabric error', async () => {
    invokeMock.mockRejectedValueOnce(new Error('fail'))
    const res = await request(app).post('/log').send(validEvent)
    expect(res.status).toBe(502)
  })
})
