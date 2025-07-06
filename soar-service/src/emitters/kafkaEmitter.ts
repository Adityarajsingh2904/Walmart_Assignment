import { Kafka, logLevel } from 'kafkajs';
import crypto from 'crypto';
import { format } from 'date-fns';
import pino from 'pino';
import env from '../config';
import { exponentialBackoff } from '../utils/backoff';

export interface SoarActionEvent {
  runId: string;
  playbookId: string;
  stepId: string;
  action: string;
  status: 'success' | 'failed' | 'skipped';
  details?: Record<string, unknown>;
  timestamp: string;
}

const logger = pino({ level: 'debug' });

const kafka = new Kafka({
  clientId: env.KAFKA_CLIENT_ID,
  brokers: env.KAFKA_BROKERS.split(',')
});

const producer = kafka.producer({
  idempotent: true,
  transactionalId: `soar-action-${process.pid}`,
  maxInFlightRequests: 1,
  retry: { retries: 0 },
  transactionTimeout: env.KAFKA_TRANSACTION_TIMEOUT
    ? Number(env.KAFKA_TRANSACTION_TIMEOUT)
    : undefined
});

let connected: Promise<void> | null = null;
function ensureConnected() {
  if (!connected) {
    connected = producer.connect();
  }
  return connected;
}

export function computeKey(event: SoarActionEvent): string {
  return crypto
    .createHash('sha256')
    .update(`${event.runId}|${event.stepId}|${event.timestamp}`)
    .digest('hex');
}

export async function emitAction(event: SoarActionEvent): Promise<void> {
  await ensureConnected();
  const topicDate = format(new Date(event.timestamp), 'yyyyMMdd');
  const topic = `soar_action_${topicDate}`;
  const key = computeKey(event);

  await exponentialBackoff(async () => {
    const txn = await producer.transaction();
    try {
      await txn.send({
        topic,
        messages: [{ key, value: JSON.stringify(event) }]
      });
      await txn.commit();
    } catch (err: any) {
      await txn.abort().catch(() => undefined);
      if (err?.retriable) throw err;
      throw err;
    }
  }, { retries: 5, base: 200, factor: 1.8, max: 10000 });

  logger.debug({ event }, 'action emitted');
}

export async function withAudit<T>(base: Partial<SoarActionEvent>, fn: () => Promise<T>): Promise<T> {
  try {
    const res = await fn();
    await emitAction({ ...base, status: 'success', timestamp: new Date().toISOString(), details: undefined } as SoarActionEvent);
    return res;
  } catch (err) {
    const redacted = { ...base, details: undefined, status: 'failed', timestamp: new Date().toISOString() } as SoarActionEvent;
    logger.error({ err, event: redacted }, 'audit failure');
    await emitAction(redacted);
    throw err;
  }
}

export async function shutdown(): Promise<void> {
  if (connected) {
    await producer.disconnect();
    connected = null;
  }
}
