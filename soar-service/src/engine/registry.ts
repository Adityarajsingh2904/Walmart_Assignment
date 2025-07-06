export type StepType = 'isolate_host' | 'reset_password' | 'notify';
import type { Playbook, Step } from '../playbook/types';
import type { AlertEvent, StepResult, ExecutionCtx } from './types';

export type StepHandler = (
  playbook: Playbook,
  step: Step,
  alert: AlertEvent,
  ctx: ExecutionCtx
) => Promise<StepResult>;

const registry = new Map<StepType, StepHandler>();

export function register(type: StepType, fn: StepHandler): void {
  if (registry.has(type)) {
    throw new Error(`handler already registered for ${type}`);
  }
  registry.set(type, fn);
}

export function get(type: StepType): StepHandler {
  const handler = registry.get(type);
  if (!handler) {
    throw new Error(`no handler registered for ${type}`);
  }
  return handler;
}

// test helper
export function clearRegistry() {
  registry.clear();
}
