import { Request, Response, NextFunction, RequestHandler } from 'express'
import { z } from 'zod'
import { Pool } from 'pg'

const usageSchema = z.object({
  model: z.string(),
  prompt_tokens: z.number(),
  completion_tokens: z.number(),
  cost: z.number()
})

export default function openaiUsage(pool: Pool): RequestHandler {
  return function (req: Request, _res: Response, next: NextFunction) {
    const header = req.header('x-openai-usage')
    if (!header) return next()
    try {
      const usage = usageSchema.parse(JSON.parse(header))
      void pool
        .query(
          'INSERT INTO openai_usage(model, prompt_tokens, completion_tokens, cost) VALUES ($1,$2,$3,$4)',
          [usage.model, usage.prompt_tokens, usage.completion_tokens, usage.cost]
        )
        .catch((err) => {
          console.error('openai_usage insert failed', err)
        })
    } catch {
      // ignore malformed header
    }
    next()
  }
}
