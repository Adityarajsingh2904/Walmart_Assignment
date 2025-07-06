import { Client } from 'ssh2';
import { readFileSync } from 'fs';
import type { Playbook, Step } from '../../playbook/types';
import type { AlertEvent, StepResult, ExecutionCtx } from '../types';
import type { StepType } from '../registry';

interface IsolateStep extends Step {
  type: 'isolate_host';
  host: string;
}

export async function isolateHost(
  _playbook: Playbook,
  step: IsolateStep,
  _alert: AlertEvent,
  _ctx: ExecutionCtx
): Promise<StepResult> {
  const start = Date.now();
  void _alert;
  void _ctx;
  return new Promise<StepResult>((resolve) => {
    const conn = new Client();
    conn
      .on('ready', () => {
        conn.exec(`/opt/trustvault/isolate.sh ${step.host}`, (err, stream) => {
          if (err) {
            conn.end();
            resolve({
              stepId: step.id,
              type: step.type as StepType,
              status: 'failed',
              attempts: 1,
              durationMs: Date.now() - start,
              error: err.message,
            });
            return;
          }
          stream
            .on('close', (code) => {
              conn.end();
              const success = code === 0;
              resolve({
                stepId: step.id,
                type: step.type as StepType,
                status: success ? 'success' : 'failed',
                attempts: 1,
                durationMs: Date.now() - start,
                error: success ? undefined : `exit ${code}`,
              });
            })
            .resume();
        });
      })
      .on('error', (err) => {
        resolve({
          stepId: step.id,
          type: step.type as StepType,
          status: 'failed',
          attempts: 1,
          durationMs: Date.now() - start,
          error: err.message,
        });
      })
      .connect({
        host: step.host,
        username: 'root',
        privateKey: process.env.SSH_KEY_PATH
          ? readFileSync(process.env.SSH_KEY_PATH)
          : undefined,
      });
  });
}
