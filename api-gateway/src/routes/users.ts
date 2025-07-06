import { Router, json } from 'express'
import { z } from 'zod'
import auth from '../middleware/auth'
import { getServiceUrl } from '../config/services'
import { createProxyHandler } from '../lib/proxy'

const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  roles: z.array(z.string())
})

const router = Router()
router.use('/users', auth(), json(), createProxyHandler(getServiceUrl('users'), UserSchema))

export default router
