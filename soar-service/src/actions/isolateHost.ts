import { readFileSync } from 'fs';
import SSH from 'ssh2-promise';
import type { Playbook, Step } from '../playbook/types';
import type { AlertEvent, ExecutionCtx } from '../engine/types';
import type { ActionResult } from './index';

type IsolateStep = Extract<Step, { type: 'isolate_host' }>;

export default async function isolateHost(
  playbook: Playbook,
  step: Step,
  _alert: AlertEvent,
  _ctx: ExecutionCtx
): Promise<ActionResult> {
  const start = Date.now();
  const s = step as IsolateStep;
  const ssh = new SSH({
    host: s.host,
    username: 'root',
    privateKey: process.env.SSH_KEY_PATH
      ? readFileSync(process.env.SSH_KEY_PATH, 'utf8')
      : undefined,
  });

  let status: 'success' | 'failed' = 'success';
  let code = 0;
  try {
    await ssh.connect();
    await ssh.exec('sudo iptables -A INPUT -j DROP');
    await ssh.exec('sudo iptables -A OUTPUT -j DROP');
  } catch (err) {
    status = 'failed';
    code = 1;
  } finally {
    await ssh.close().catch(() => undefined);
  }

  return {
    playbookId: playbook.id,
    stepId: step.id,
    type: step.type,
    status,
    durationMs: Date.now() - start,
    metadata: { host: s.host, cmd: 'iptables', exitCode: code },
  };
}
