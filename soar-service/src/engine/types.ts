import type { StepType } from './registry';

export interface AlertEvent {
  id: string;
  class: string;
  severity: 'low' | 'medium' | 'high';
  context: Record<string, unknown>;
  ts: string; // ISO-8601
}

export interface StepResult {
  stepId: string;
  type: StepType;
  status: 'success' | 'failed' | 'skipped';
  attempts: number;
  durationMs: number;
  output?: Record<string, unknown>;
  error?: string;
}

export interface ExecutionResult {
  runId: string;
  playbookId: string;
  overallStatus: 'success' | 'failed' | 'partial';
  stepResults: StepResult[];
  startedAt: string;
  endedAt: string;
}

export interface ExecutionCtx {
  logger?: { info: (...args: unknown[]) => void; error: (...args: unknown[]) => void };
}
