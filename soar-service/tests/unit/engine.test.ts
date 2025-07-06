import { clearRegistry, register } from '../../src/engine/registry';
import { runPlaybook } from '../../src/engine';
import type { Playbook } from '../../src/playbook/types';
import type { AlertEvent, StepResult } from '../../src/engine/types';

afterEach(() => {
  clearRegistry();
});

describe('engine', () => {
  const pb: Playbook = {
    id: 'pb1',
    name: 'test',
    description: 'd',
    triggers: { class: 'test', severity: ['high'] },
    steps: [
      { id: 'a', type: 'notify', channel: 'slack', target: '#t', message: 'hi' },
    ],
    version: 'v1',
    createdAt: new Date().toISOString(),
  };

  const alert: AlertEvent = {
    id: 'alert1',
    class: 'test',
    severity: 'high',
    context: {},
    ts: new Date().toISOString(),
  };

  it('executes playbook steps', async () => {
    register('notify', async () => ({ status: 'success', attempts: 1, durationMs: 0, stepId: 'a', type: 'notify' } as StepResult));
    const res = await runPlaybook(pb, alert);
    expect(res.stepResults).toHaveLength(1);
    expect(res.stepResults[0].status).toBe('success');
  });

  it('prevents duplicate registrations', () => {
    register('notify', async () => ({ stepId: 'a', type: 'notify', status: 'success', attempts: 1, durationMs: 0 }));
    expect(() => register('notify', async () => ({ stepId: 'a', type: 'notify', status: 'success', attempts: 1, durationMs: 0 }))).toThrow();
  });
});
