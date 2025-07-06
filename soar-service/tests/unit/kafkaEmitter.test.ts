import { Kafka } from 'kafkajs';

const sendMock = jest.fn();
const commitMock = jest.fn();
const abortMock = jest.fn();
const transactionMock = jest.fn(() => ({ send: sendMock, commit: commitMock, abort: abortMock }));
const connectMock = jest.fn();
const disconnectMock = jest.fn();

jest.mock('kafkajs', () => ({
  Kafka: jest.fn(() => ({
    producer: jest.fn(() => ({
      connect: connectMock,
      transaction: transactionMock,
      disconnect: disconnectMock,
    })),
  })),
  logLevel: {},
}));

import { emitAction, computeKey, withAudit, shutdown } from '../../src/emitters/kafkaEmitter';
import type { SoarActionEvent } from '../../src/emitters/kafkaEmitter';
import * as emitter from '../../src/emitters/kafkaEmitter';

describe('kafkaEmitter', () => {
  beforeEach(() => {
    sendMock.mockReset().mockResolvedValue(undefined);
    commitMock.mockReset().mockResolvedValue(undefined);
    abortMock.mockReset().mockResolvedValue(undefined);
    transactionMock.mockClear();
    connectMock.mockReset().mockResolvedValue(undefined);
  });

  const baseEvent: SoarActionEvent = {
    runId: 'a',
    playbookId: 'pb',
    stepId: 'step',
    action: 'act',
    status: 'success',
    timestamp: '2024-01-01T00:00:00.000Z'
  };

  it('computes stable key', () => {
    const key = computeKey(baseEvent);
    expect(key).toBe('69aaaf350ec1407c1b74cda4f5e64e6fa45ba8ec9c43dccab1eb966733d87cf3');
  });

  it('emits action successfully', async () => {
    sendMock.mockResolvedValue(undefined);
    commitMock.mockResolvedValue(undefined);

    await emitAction(baseEvent);

    expect(connectMock).toHaveBeenCalled();
    expect(sendMock).toHaveBeenCalledTimes(1);
    const arg = sendMock.mock.calls[0][0];
    expect(arg.topic).toBe('soar_action_20240101');
  });

  it('retries and throws after cap', async () => {
    const err = Object.assign(new Error('fail'), { retriable: true });
    sendMock.mockRejectedValue(err);

    await expect(emitAction(baseEvent)).rejects.toThrow('fail');
    expect(sendMock.mock.calls.length).toBeGreaterThan(1);
  });

  it('throws immediately on non-retriable error', async () => {
    sendMock.mockRejectedValue(new Error('nope'));
    await expect(emitAction(baseEvent)).rejects.toThrow('nope');
    expect(sendMock.mock.calls.length).toBeGreaterThan(1);
  });

  it('wraps function with audit success', async () => {
    const fn = jest.fn().mockResolvedValue(42);
    await withAudit(baseEvent, fn);
    expect(sendMock).toHaveBeenCalled();
  });

  it('wraps function with audit failure', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('oops'));
    await expect(withAudit(baseEvent, fn)).rejects.toThrow('oops');
    expect(sendMock).toHaveBeenCalled();
  });

  it('shutdown disconnects', async () => {
    await shutdown();
    expect(disconnectMock).toHaveBeenCalled();
  });
});
