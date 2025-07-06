import { z } from 'zod'
import { config } from 'dotenv'
config({ path: __dirname + '/../../.env.example' })

const envSchema = z.object({
  PORT: z.string().default('8080'),
  JWT_AUDIENCE: z.string(),
  JWKS_URI: z.string(),
  OPENAI_ORG: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  LOG_LEVEL: z.string().default('info'),
  ALERTS_URL: z.string(),
  SOAR_URL: z.string(),
  LEDGER_URL: z.string(),
  IAM_URL: z.string()
})

const env = envSchema.parse(process.env)

export default {
  port: Number(env.PORT),
  jwtAudience: env.JWT_AUDIENCE,
  jwksUri: env.JWKS_URI,
  openaiOrg: env.OPENAI_ORG,
  openaiApiKey: env.OPENAI_API_KEY,
  logLevel: env.LOG_LEVEL,
  alertsUrl: env.ALERTS_URL,
  soarUrl: env.SOAR_URL,
  ledgerUrl: env.LEDGER_URL,
  iamUrl: env.IAM_URL
}
