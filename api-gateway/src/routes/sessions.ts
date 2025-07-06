import { Router } from 'express'
import { createProxyMiddleware } from 'http-proxy-middleware'
import config from '../config'

const router = Router()
router.use('/', createProxyMiddleware({ target: config.iamUrl, changeOrigin: true, pathRewrite: { '^/sessions': '/sessions' } }))
export default router
