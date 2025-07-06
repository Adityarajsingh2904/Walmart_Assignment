import { Server } from 'socket.io'

export function attachSocket(io: Server) {
  io.on('connection', socket => {
    socket.emit('connected')
  })
}
