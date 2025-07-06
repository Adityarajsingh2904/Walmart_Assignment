import express from 'express'
import dotenv from 'dotenv'
import swaggerUi from 'swagger-ui-express'
import openapiSpec from './lib/openapi'
import exampleRoutes from './routes/example'

dotenv.config()

export function createApp() {
  const app = express()
  app.use(exampleRoutes)
  app.get('/docs-json', (_req, res) => res.json(openapiSpec))
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapiSpec))
  app.get('/healthz', (_req, res) => {
    res.json({ status: 'ok' })
  })
  return app
}

/* c8 ignore start */
import http from 'http'
import { initSocket } from './lib/socket'

if (require.main === module) {
  const port = Number(process.env.PORT) || 8000
  const app = createApp()
  const server = http.createServer(app)
  initSocket(server)
  server.listen(port, () => {
    console.log(`API Gateway listening on ${port}`)
  })
}
/* c8 ignore stop */
