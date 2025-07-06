import { getHandler } from '../../../src/actions';
import type { Playbook } from '../../../src/playbook/types';

const postMessage = jest.fn();
const send = jest.fn();

jest.mock('@slack/web-api', () => ({ WebClient: jest.fn(() => ({ chat: { postMessage } })) }));
jest.mock('@aws-sdk/client-sns', () => ({
  SNSClient: jest.fn(() => ({ send })),
  PublishCommand: jest.fn((input) => input)
}));

const playbook: Playbook = {
  id: 'pb1',
  name: 'pb',
  description: 'd',
  triggers: { class: 't', severity: ['high'] as const },
  steps: [],
  version: 'v1',
  createdAt: new Date().toISOString(),
};
const alert = { id: 'a', class: 't', severity: 'high' as const, context: {}, ts: new Date().toISOString() };

describe('notify action', () => {
  beforeEach(() => {
    postMessage.mockReset().mockResolvedValue(undefined);
    send.mockReset().mockResolvedValue(undefined);
  });

  it('sends slack message', async () => {
    const step = { id: 'n1', type: 'notify' as const, channel: 'slack', target: '#c', message: 'hi' };
    const handler = getHandler('notify');
    const res = await handler(playbook, step, alert, {});
    expect(postMessage).toHaveBeenCalled();
    expect(res.status).toBe('success');
    expect(res.metadata).toEqual({ mode: 'slack', target: '#c' });
  });

  it('sends sns message', async () => {
    const step = { id: 'n2', type: 'notify' as const, channel: 'sns', target: 'arn', message: 'hi' };
    const handler = getHandler('notify');
    const res = await handler(playbook, step, alert, {});
    expect(send).toHaveBeenCalled();
    expect(res.status).toBe('success');
    expect(res.metadata).toEqual({ mode: 'sns', target: 'arn' });
  });

  it('handles failure', async () => {
    postMessage.mockRejectedValue(new Error('fail'));
    const step = { id: 'n3', type: 'notify' as const, channel: 'slack', target: '#c', message: 'hi' };
    const handler = getHandler('notify');
    const res = await handler(playbook, step, alert, {});
    expect(res.status).toBe('failed');
  });
});
