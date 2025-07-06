import { Router, json } from 'express'
import { z } from 'zod'
import auth from '../middleware/auth'
import { getServiceUrl } from '../config/services'
import { createProxyHandler } from '../lib/proxy'

const SessionSchema = z.object({
  data: z.array(z.object({
    jti: z.string(),
    ip: z.string(),
    device: z.string(),
    created_at: z.string(),
    last_seen: z.string().nullable(),
    revoked: z.boolean()
  })),
  next: z.string().nullable()
})

const router = Router()
router.use('/sessions', auth(), json(), createProxyHandler(getServiceUrl('sessions'), SessionSchema))

export default router
