import { config as load } from 'dotenv-flow';
import { z } from 'zod';

load();

const envSchema = z.object({
  KAFKA_BROKERS: z.string().default('localhost:9092'),
  KAFKA_CLIENT_ID: z.string().default('soar-service'),
  KAFKA_TRANSACTION_TIMEOUT: z.string().optional(),
  SLACK_TOKEN: z.string().optional(),
  AWS_REGION: z.string().default('us-east-1'),
  AWS_SNS_TOPIC: z.string().optional(),
  SSH_KEY_PATH: z.string().default('/keys/soar_rsa'),
  METRICS_PORT: z.string().default('8003'),
  LOG_LEVEL: z.string().default('info'),
});

type Env = z.infer<typeof envSchema>;

const env: Env = envSchema.parse(process.env);

export default env;
