import { RequestHandler } from 'express'
import crypto from 'crypto'
import logger from '../logger'
import fabric from '../fabric'
import { SoarActionEventSchema } from '../models/SoarActionEvent'

const logEvent: RequestHandler = async (req, res) => {
  const parsed = SoarActionEventSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid_request' })
  }
  const event = parsed.data
  const key = crypto
    .createHash('sha256')
    .update(`${event.runId}|${event.stepId}|${event.timestamp}`)
    .digest('hex')

  try {
    await fabric.invoke('LogEvent', [key, JSON.stringify(event)])
    res.status(202).json({ key })
  } catch (err) {
    logger.error({ err }, 'fabric invoke failed')
    res.status(502).json({ error: 'fabric_error' })
  }
}

export default logEvent
