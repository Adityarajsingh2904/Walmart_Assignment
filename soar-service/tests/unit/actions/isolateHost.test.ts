import { getHandler } from '../../../src/actions';

const connect = jest.fn();
const exec = jest.fn();
const close = jest.fn();

jest.mock('ssh2-promise', () => {
  return jest.fn().mockImplementation(() => ({ connect, exec, close }));
});

import type { Playbook } from '../../../src/playbook/types';

const playbook: Playbook = {
  id: 'pb1',
  name: 'pb',
  description: 'd',
  triggers: { class: 't', severity: ['high'] as const },
  steps: [],
  version: 'v1',
  createdAt: new Date().toISOString(),
};
const step = { id: 's1', type: 'isolate_host' as const, host: '1.1.1.1' };
const alert = { id: 'a', class: 't', severity: 'high' as const, context: {}, ts: new Date().toISOString() };

describe('isolateHost action', () => {
  beforeEach(() => {
    connect.mockResolvedValue(undefined);
    exec.mockReset();
    exec.mockResolvedValue('');
    close.mockResolvedValue(undefined);
  });

  it('returns success metadata', async () => {
    const handler = getHandler('isolate_host');
    const res = await handler(playbook, step, alert, {});
    expect(exec).toHaveBeenCalledTimes(2);
    expect(res.status).toBe('success');
    expect(res.metadata).toEqual({ host: step.host, cmd: 'iptables', exitCode: 0 });
  });

  it('handles command failure', async () => {
    exec.mockRejectedValue(new Error('boom'));
    const handler = getHandler('isolate_host');
    const res = await handler(playbook, step, alert, {});
    expect(res.status).toBe('failed');
    expect(res.metadata.exitCode).toBe(1);
  });

  it('handles network error', async () => {
    connect.mockRejectedValue(new Error('net'));
    const handler = getHandler('isolate_host');
    const res = await handler(playbook, step, alert, {});
    expect(res.status).toBe('failed');
  });
});
