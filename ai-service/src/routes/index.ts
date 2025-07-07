import { Router } from 'express'
import feedbackRouter from './feedback'

const router = Router()

router.use('/feedback', feedbackRouter)

export default router
