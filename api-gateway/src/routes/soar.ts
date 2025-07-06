import { Router, json } from 'express'
import { z } from 'zod'
import auth from '../middleware/auth'
import { getServiceUrl } from '../config/services'
import { createProxyHandler } from '../lib/proxy'

const SoarSchema = z.any()

const router = Router()
router.use('/soar', auth(), json(), createProxyHandler(getServiceUrl('soar'), SoarSchema))

export default router
