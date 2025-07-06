import { config as load } from 'dotenv'
import { z } from 'zod'

load()

const envSchema = z.object({
  PORT: z.string().default(process.env.METRICS_PORT || '8083'),
  BROKER_URL: z.string().default(process.env.KAFKA_BROKERS || 'kafka:9092'),
  SLACK_TOKEN: z.string().optional(),
  AWS_REGION: z.string().default('us-east-1'),
  AWS_SNS_TOPIC: z.string().optional(),
  SSH_KEY_PATH: z.string().default('/keys/soar_rsa'),
  LOG_LEVEL: z.string().default('info'),
  KAFKA_CLIENT_ID: z.string().default('soar-service'),
  KAFKA_TRANSACTION_TIMEOUT: z.string().optional()
})

export type Env = z.infer<typeof envSchema>
export default envSchema.parse(process.env) as Env
