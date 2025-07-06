import { randomUUID } from 'crypto';
import type { Playbook } from '../playbook/types';
import { get as getHandler } from './registry';
import type { AlertEvent, ExecutionResult, StepResult, ExecutionCtx } from './types';

export async function runPlaybook(
  playbook: Playbook,
  alert: AlertEvent,
  ctx: ExecutionCtx = {}
): Promise<ExecutionResult> {
  const runId = randomUUID();
  const started = new Date();
  const stepResults: StepResult[] = [];

  for (const step of playbook.steps) {
    const start = Date.now();
    let status: StepResult;
    try {
      const handler = getHandler(step.type);
      const res = await handler(playbook, step, alert, ctx);
      status = {
        ...res,
        stepId: step.id,
        type: step.type,
        attempts: res.attempts || 1,
        durationMs: Date.now() - start,
      };
    } catch (err) {
      if (ctx.logger) ctx.logger.error(err);
      const message = err instanceof Error ? err.message : String(err);
      status = {
        stepId: step.id,
        type: step.type,
        status: 'failed',
        attempts: 1,
        durationMs: Date.now() - start,
        error: message,
      };
    }
    stepResults.push(status);
  }

  const successCount = stepResults.filter(r => r.status === 'success').length;
  const overall: ExecutionResult['overallStatus'] =
    successCount === stepResults.length
      ? 'success'
      : successCount > 0
      ? 'partial'
      : 'failed';

  return {
    runId,
    playbookId: playbook.id,
    overallStatus: overall,
    stepResults,
    startedAt: started.toISOString(),
    endedAt: new Date().toISOString(),
  };
}

export type { AlertEvent, ExecutionResult, StepResult } from './types';
