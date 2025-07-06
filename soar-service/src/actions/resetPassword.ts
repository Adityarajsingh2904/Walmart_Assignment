import { readFileSync } from 'fs';
import { randomBytes } from 'crypto';
import SSH from 'ssh2-promise';
import type { Playbook, Step } from '../playbook/types';
import type { AlertEvent, ExecutionCtx } from '../engine/types';
import type { ActionResult } from './index';

type ResetStep = Extract<Step, { type: 'reset_password' }>;

export default async function resetPassword(
  playbook: Playbook,
  step: Step,
  _alert: AlertEvent,
  _ctx: ExecutionCtx
): Promise<ActionResult> {
  const start = Date.now();
  const s = step as ResetStep;
  const ssh = new SSH({
    host: s.host,
    username: 'root',
    privateKey: process.env.SSH_KEY_PATH
      ? readFileSync(process.env.SSH_KEY_PATH, 'utf8')
      : undefined,
  });

  const pass = randomBytes(18).toString('base64');
  let status: 'success' | 'failed' = 'success';
  try {
    await ssh.connect();
    const cmd = `echo '${s.user}:${pass}' | sudo chpasswd`;
    await ssh.exec(cmd);
  } catch (_err) {
    status = 'failed';
  } finally {
    await ssh.close().catch(() => undefined);
  }

  return {
    playbookId: playbook.id,
    stepId: step.id,
    type: s.type,
    status,
    durationMs: Date.now() - start,
    metadata: { host: s.host, user: s.user },
  };
}
