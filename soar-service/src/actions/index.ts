import type { Playbook, Step } from '../playbook/types';
import type { AlertEvent, ExecutionCtx } from '../engine/types';
import type { StepType } from '../engine/registry';

export interface ActionResult {
  playbookId: string;
  stepId: string;
  type: StepType;
  status: 'success' | 'failed';
  durationMs: number;
  metadata: Record<string, unknown>;
}

export type ActionHandler = (
  playbook: Playbook,
  step: Step,
  alert: AlertEvent,
  ctx: ExecutionCtx
) => Promise<ActionResult>;

const registry = new Map<StepType, ActionHandler>();

export function register(type: StepType, fn: ActionHandler): void {
  if (registry.has(type)) {
    throw new Error(`handler already registered for ${type}`);
  }
  registry.set(type, fn);
}

export function getHandler(type: StepType): ActionHandler {
  const handler = registry.get(type);
  if (!handler) {
    throw new Error(`no handler registered for ${type}`);
  }
  return handler;
}

export function clearRegistry(): void {
  registry.clear();
}

// built-in handlers
import isolateHost from './isolateHost';
import resetPassword from './resetPassword';
import notify from './notify';

register('isolate_host', isolateHost);
register('reset_password', resetPassword);
register('notify', notify);

