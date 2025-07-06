import { Gateway, Wallets, Contract } from 'fabric-network';
import { readFile } from 'fs/promises';
import { Readable } from 'stream';
import { config } from 'dotenv';
import pino from 'pino';
import { z } from 'zod';

config();

export const AlertActionSchema = z.object({
  id: z.string(),
  runId: z.string(),
  playbookId: z.string(),
  stepId: z.string(),
  action: z.string(),
  status: z.string(),
  timestamp: z.string()
});
export type AlertAction = z.infer<typeof AlertActionSchema>;

export interface VerifyResult {
  valid: boolean;
  ledgerHash: string;
  providedHash: string;
}

const logger = pino({ level: 'info' });

let gateway: Gateway | null = null;

export async function initGateway(): Promise<Gateway> {
  if (gateway) return gateway;
  const ccpPath = process.env.FABRIC_CONN_PROFILE as string;
  const walletPath = process.env.FABRIC_WALLET_PATH as string;
  const ccp = JSON.parse(await readFile(ccpPath, 'utf8'));
  const wallet = await Wallets.newFileSystemWallet(walletPath);
  gateway = new Gateway();
  await gateway.connect(ccp, {
    wallet,
    identity: process.env.FABRIC_IDENTITY || 'appUser',
    discovery: { enabled: true, asLocalhost: true }
  });
  const disconnect = () => {
    gateway?.disconnect();
    gateway = null;
  };
  process.once('SIGINT', disconnect);
  process.once('SIGTERM', disconnect);
  return gateway;
}

function isTransient(err: any): boolean {
  return err?.code === 14 || /unavailable/i.test(err?.message || '');
}

async function getContract(): Promise<Contract> {
  const gw = await initGateway();
  const network = await gw.getNetwork(process.env.FABRIC_CHANNEL as string);
  return network.getContract(process.env.FABRIC_CC_NAME as string);
}

async function retry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err) {
      if (isTransient(err) && attempt < retries - 1) {
        attempt++;
        await new Promise(res => setTimeout(res, 50 * attempt));
        continue;
      }
      throw err;
    }
  }
}

export async function logEvent(event: AlertAction): Promise<string> {
  const valid = AlertActionSchema.parse(event);
  const contract = await getContract();
  const tx = contract.createTransaction('LogEvent');
  const txId = tx.getTransactionId();
  await retry(() => tx.submit(JSON.stringify(valid)));
  return txId;
}

export async function verifyIntegrity(key: string, expectedHash: string): Promise<VerifyResult> {
  const contract = await getContract();
  const buf = await retry(() => contract.evaluateTransaction('VerifyHash', key, expectedHash));
  return JSON.parse(buf.toString()) as VerifyResult;
}

export async function exportCsv(): Promise<NodeJS.ReadableStream> {
  const contract = await getContract();
  const buf = await retry(() => contract.evaluateTransaction('ExportCSV'));
  return Readable.from([buf.toString()]);
}
