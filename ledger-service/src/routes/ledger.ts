import { Router } from 'express'
import { AlertActionSchema } from '../validators/AlertAction'
import { logEvent, verifyIntegrity, exportCsv } from '../fabricClient'
import { ledgerLogTotal } from '../server'
import logger from '../logger'

const router = Router()

router.post('/log-event', async (req, res) => {
  const parsed = AlertActionSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Bad Request' })
  try {
    await logEvent(parsed.data)
    ledgerLogTotal.inc({ status: 'success' })
    res.status(201).json({ status: 'logged' })
  } catch (err) {
    logger.error({ err }, 'log-event failed')
    ledgerLogTotal.inc({ status: 'error' })
    res.status(500).json({ error: 'internal_error' })
  }
})

router.get('/verify/:key', async (req, res) => {
  const { key } = req.params
  const hash = req.query.hash
  if (!hash || typeof hash !== 'string') {
    return res.status(400).json({ error: 'Bad Request' })
  }
  try {
    const result = await verifyIntegrity(key, hash)
    res.json({ key, ...result })
  } catch (err) {
    logger.error({ err }, 'verify failed')
    res.status(500).json({ error: 'internal_error' })
  }
})

router.get('/export.csv', async (_req, res) => {
  try {
    const stream = await exportCsv()
    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', 'attachment; filename="ledger-export.csv"')
    stream.pipe(res)
  } catch (err) {
    logger.error({ err }, 'export failed')
    res.status(500).json({ error: 'internal_error' })
  }
})

export default router
