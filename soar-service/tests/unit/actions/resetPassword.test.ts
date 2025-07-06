import { getHandler } from '../../../src/actions';
import type { Playbook } from '../../../src/playbook/types';

const connect = jest.fn();
const exec = jest.fn();
const close = jest.fn();

jest.mock('ssh2-promise', () => jest.fn(() => ({ connect, exec, close })));

const playbook: Playbook = {
  id: 'pb1',
  name: 'pb',
  description: 'd',
  triggers: { class: 't', severity: ['high'] as const },
  steps: [],
  version: 'v1',
  createdAt: new Date().toISOString(),
};
const step = { id: 's2', type: 'reset_password' as const, host: '1.2.3.4', user: 'ubuntu' };
const alert = { id: 'a', class: 't', severity: 'high' as const, context: {}, ts: new Date().toISOString() };

describe('resetPassword action', () => {
  beforeEach(() => {
    connect.mockResolvedValue(undefined);
    exec.mockReset();
    exec.mockResolvedValue('');
    close.mockResolvedValue(undefined);
  });

  it('executes chpasswd', async () => {
    const handler = getHandler('reset_password');
    const res = await handler(playbook, step, alert, {});
    expect(exec).toHaveBeenCalledWith(expect.stringContaining('chpasswd'));
    expect(res.status).toBe('success');
    expect(res.metadata).toEqual({ host: step.host, user: step.user });
  });

  it('handles errors', async () => {
    exec.mockRejectedValue(new Error('oops'));
    const handler = getHandler('reset_password');
    const res = await handler(playbook, step, alert, {});
    expect(res.status).toBe('failed');
  });
});
