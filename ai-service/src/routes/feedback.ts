import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../prisma/client'
import logger from '../logger'
import { kafkaProducer } from '../kafka'

const router = Router()

const feedbackSchema = z.object({
  alertId: z.string().uuid(),
  reason: z.string().min(5)
})

/**
 * @openapi
 * /feedback:
 *   post:
 *     tags: [Feedback]
 *     summary: Ingest false-positive feedback
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - alertId
 *               - reason
 *             properties:
 *               alertId:
 *                 type: string
 *                 format: uuid
 *               reason:
 *                 type: string
 *                 minLength: 5
 *     responses:
 *       201:
 *         description: Created
 *       400:
 *         description: Validation error
 *       404:
 *         description: Alert not found
 *       500:
 *         description: Internal server error
 */
router.post('/', async (req: Request, res: Response) => {
  const parsed = feedbackSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.errors })
  }

  const { alertId, reason } = parsed.data

  try {
    const alert = await prisma.alerts.findUnique({ where: { id: alertId } })
    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' })
    }

    const feedback = await prisma.feedback.create({
      data: { alertId, reason }
    })

    try {
      await kafkaProducer.send({
        topic: 'feedbackReceived',
        messages: [{ value: JSON.stringify({ feedbackId: feedback.id, alertId, reason }) }]
      })
    } catch (err) {
      logger.error({ err }, 'failed to emit feedbackReceived')
    }

    res.status(201).json(feedback)
  } catch (err) {
    logger.error({ err }, 'failed to create feedback')
    res.status(500).json({ error: 'Internal Server Error' })
  }
})

export default router
