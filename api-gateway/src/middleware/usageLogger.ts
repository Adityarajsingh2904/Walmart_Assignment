import { Request, Response, NextFunction } from 'express'
import OpenAI from 'openai'
import config from '../config'

const openai = new OpenAI({ apiKey: config.openaiApiKey })

export async function usageLogger(req: Request, _res: Response, next: NextFunction) {
  if (req.path.startsWith('/')) {
    // In real app you would record usage metrics
    if (config.openaiApiKey) {
      try {
        await openai.chat.completions.create({ model: 'gpt-3.5-turbo', messages: [{ role: 'user', content: 'ping' }], max_tokens: 1 })
      } catch {
        // ignore
      }
    }
  }
  next()
}
