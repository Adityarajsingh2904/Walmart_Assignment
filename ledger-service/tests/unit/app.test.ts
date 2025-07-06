import request from 'supertest'
import app from '../../src'
import client from '../../src/client'

jest.mock('../../src/client')

describe('routes', () => {
  it('logs event', async () => {
    const mock = client as jest.Mocked<typeof client>
    mock.logEvent.mockResolvedValueOnce()
    const res = await request(app)
      .post('/log-event')
      .send({ runId: '1', action: 'test', message: 'ok', timestamp: 'now' })
    expect(res.status).toBe(201)
    expect(mock.logEvent).toHaveBeenCalled()
  })

  it('verifies run', async () => {
    const mock = client as jest.Mocked<typeof client>
    mock.verify.mockResolvedValueOnce(true)
    const res = await request(app).get('/verify/1')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ runId: '1', verified: true })
    expect(mock.verify).toHaveBeenCalledWith('1')
  })

  it('exports csv', async () => {
    const mock = client as jest.Mocked<typeof client>
    mock.getEvents.mockResolvedValueOnce([{ runId: '1', action: 'a', message: 'm', timestamp: 't' }])
    const res = await request(app).get('/export/csv')
    expect(res.status).toBe(200)
    expect(res.text).toContain('runId')
    expect(mock.getEvents).toHaveBeenCalled()
  })
})
