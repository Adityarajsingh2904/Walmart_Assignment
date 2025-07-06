import { Server } from 'socket.io'
import type http from 'http'

export let io: Server

export function initSocket(server: http.Server) {
  const origins = (process.env.SOCKET_CORS_ORIGINS ?? '')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean)
  io = new Server(server, {
    path: '/socket',
    cors: origins.length ? { origin: origins } : { origin: '*' }
  })

  io.use((socket, next) => {
    // track activity for idle disconnect
    socket.data.lastActivity = Date.now()
    socket.onAny(() => {
      socket.data.lastActivity = Date.now()
    })
    next()
  })

  setInterval(() => {
    for (const [_id, socket] of io.of('/socket').sockets) {
      if (Date.now() - (socket.data.lastActivity as number) > 30 * 60_000) {
        socket.disconnect(true)
      }
    }
  }, 60_000)

  return io
}
