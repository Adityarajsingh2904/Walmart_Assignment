import { Router, json } from 'express'
import { z } from 'zod'
import auth from '../middleware/auth'
import { trackRoute } from '../middleware/metrics'
import { getServiceUrl } from '../config/services'
import { createProxyHandler } from '../lib/proxy'

const LedgerSchema = z.any()

const router = Router()
router.use(
  '/ledger',
  trackRoute('ledger'),
  auth(),
  json(),
  createProxyHandler(getServiceUrl('ledger'), LedgerSchema)
)

export default router
