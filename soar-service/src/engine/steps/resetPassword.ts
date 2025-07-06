import type { Playbook, Step } from '../../playbook/types';
import type { AlertEvent, StepResult, ExecutionCtx } from '../types';
import type { StepType } from '../registry';

interface ResetStep extends Step {
  type: 'reset_password';
  host: string;
  user: string;
}

export async function resetPassword(
  _playbook: Playbook,
  step: ResetStep,
  _alert: AlertEvent,
  _ctx: ExecutionCtx
): Promise<StepResult> {
  const start = Date.now();
  void _playbook;
  void _alert;
  void _ctx;
  try {
    const url = `${process.env.IAM_URL || 'http://iam:8000'}/v1/users/${step.user}/reset-password`;
    const res = await fetch(url, { method: 'POST' });
    const data = await res.json();
    return {
      stepId: step.id,
      type: step.type as StepType,
      status: res.ok ? 'success' : 'failed',
      attempts: 1,
      durationMs: Date.now() - start,
      output: res.ok ? { ticket: data.ticket } : undefined,
      error: res.ok ? undefined : data.error || res.statusText,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      stepId: step.id,
      type: step.type as StepType,
      status: 'failed',
      attempts: 1,
      durationMs: Date.now() - start,
      error: message,
    };
  }
}
