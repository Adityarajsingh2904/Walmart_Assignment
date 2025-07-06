import { config as load } from 'dotenv'
import { z } from 'zod'

load()

const envSchema = z.object({
  PORT: z.coerce.number().default(8080),
  CORS_ORIGINS: z.string().optional().default(''),
  LOG_LEVEL: z.string().optional().default('info')
})

export type Env = z.infer<typeof envSchema>
export default envSchema.parse(process.env) as Env
