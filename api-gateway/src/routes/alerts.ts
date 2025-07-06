import { Router, json } from 'express'
import { z } from 'zod'
import auth from '../middleware/auth'
import { getServiceUrl } from '../config/services'
import { createProxyHandler } from '../lib/proxy'

const AlertSchema = z.object({
  id: z.string().uuid(),
  class: z.string(),
  severity: z.enum(['low', 'medium', 'high'])
})

const router = Router()
router.use('/alerts', auth(), json(), createProxyHandler(getServiceUrl('alerts'), AlertSchema))

export default router
