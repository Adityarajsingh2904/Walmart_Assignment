import { Router } from 'express'
import { createProxyMiddleware } from 'http-proxy-middleware'
import config from '../config'

const router = Router()
router.use('/', createProxyMiddleware({ target: config.ledgerUrl, changeOrigin: true, pathRewrite: { '^/ledger': '' } }))
export default router
