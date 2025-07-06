import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import http from 'http'
import { io as Client } from 'socket.io-client'
import { createApp } from '../src/server'
import { initSocket, io } from '../src/lib/socket'

let server: http.Server
let port: number

beforeEach(async () => {
  process.env.SOCKET_CORS_ORIGINS = 'http://localhost'
  const app = createApp()
  server = http.createServer(app)
  initSocket(server)
  await new Promise(resolve => server.listen(0, resolve))
  port = (server.address() as any).port
})

afterEach(async () => {
  io.close()
  await new Promise(resolve => server.close(resolve))
})

describe('socket events', () => {
  it('broadcasts alertCreated events', async () => {
    const client = Client(`http://localhost:${port}`, { path: '/socket', transports: ['websocket'] })
    await new Promise(resolve => client.on('connect', resolve))
    const payload = { foo: 'bar' }
    const received = new Promise(resolve => {
      client.on('alertCreated', data => {
        resolve(data)
      })
    })
    io.emit('alertCreated', payload)
    expect(await received).toEqual(payload)
    client.close()
  })
})
