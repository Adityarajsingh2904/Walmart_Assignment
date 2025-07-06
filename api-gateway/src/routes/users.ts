import { Router } from 'express'
import { createProxyMiddleware } from 'http-proxy-middleware'
import config from '../config'

const router = Router()
router.use('/', createProxyMiddleware({ target: config.iamUrl, changeOrigin: true, pathRewrite: { '^/users': '/users' } }))
export default router
