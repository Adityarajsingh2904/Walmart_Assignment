import { Router } from 'express'
import { createProxyMiddleware } from 'http-proxy-middleware'
import config from '../config'

const router = Router()
router.use('/', createProxyMiddleware({ target: config.soarUrl, changeOrigin: true, pathRewrite: { '^/soar': '' } }))
export default router
