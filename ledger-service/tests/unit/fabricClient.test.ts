import { Readable } from 'stream';

const connectMock = jest.fn();
const disconnectMock = jest.fn();
const getNetworkMock = jest.fn();
const getContractMock = jest.fn();
const createTransactionMock = jest.fn();
const submitMock = jest.fn();
const evaluateMock = jest.fn();

jest.mock('fabric-network', () => ({
  Gateway: jest.fn().mockImplementation(() => ({
    connect: connectMock,
    disconnect: disconnectMock,
    getNetwork: getNetworkMock,
  })),
  Wallets: { newFileSystemWallet: jest.fn().mockResolvedValue({}) },
}));

const fs = require('fs/promises');

const sampleEvent = {
  id: 'event-1',
  runId: '111',
  playbookId: '222',
  stepId: 'step',
  action: 'act',
  status: 'success',
  timestamp: '2025-01-01T00:00:00.000Z'
};

describe('fabricClient', () => {
  beforeEach(() => {
    jest.resetModules();
    getNetworkMock.mockResolvedValue({
      getContract: () => ({
        createTransaction: createTransactionMock.mockReturnValue({
          getTransactionId: () => 'tx123',
          submit: submitMock,
        }),
        evaluateTransaction: evaluateMock,
      })
    });
    submitMock.mockReset().mockResolvedValue(undefined);
    evaluateMock.mockReset().mockResolvedValue(Buffer.from('{"ok":true}'));
    fs.readFile = jest.fn().mockResolvedValue('{}');
    process.env.FABRIC_CONN_PROFILE = './profile.json';
    process.env.FABRIC_WALLET_PATH = './wallet';
    process.env.FABRIC_CHANNEL = 'chan';
    process.env.FABRIC_CC_NAME = 'cc';
  });

  test('initGateway connects once and disconnects on signal', async () => {
    const { initGateway } = await import('../../src/fabricClient');
    const gw = await initGateway();
    expect(connectMock).toHaveBeenCalled();
    process.emit('SIGINT');
    expect(disconnectMock).toHaveBeenCalled();
  });

  test('logEvent submits transaction and returns id', async () => {
    const { logEvent } = await import('../../src/fabricClient');
    const txId = await logEvent(sampleEvent);
    expect(txId).toBe('tx123');
    expect(submitMock).toHaveBeenCalled();
  });

  test('logEvent retries on transient error', async () => {
    submitMock.mockRejectedValueOnce({ code: 14 });
    submitMock.mockResolvedValueOnce(undefined);
    const { logEvent } = await import('../../src/fabricClient');
    const txId = await logEvent(sampleEvent);
    expect(txId).toBe('tx123');
    expect(submitMock).toHaveBeenCalledTimes(2);
  });

  test('verifyIntegrity parses result', async () => {
    evaluateMock.mockResolvedValueOnce(Buffer.from(JSON.stringify({ valid: true, ledgerHash: 'a', providedHash: 'b' })));
    const { verifyIntegrity } = await import('../../src/fabricClient');
    const res = await verifyIntegrity('k', 'h');
    expect(res.valid).toBe(true);
    expect(evaluateMock).toHaveBeenCalled();
  });

  test('exportCsv returns stream', async () => {
    evaluateMock.mockResolvedValueOnce(Buffer.from('a,b'));
    const { exportCsv } = await import('../../src/fabricClient');
    const stream = await exportCsv();
    const chunks: Buffer[] = [];
    for await (const c of stream as Readable) chunks.push(Buffer.from(c));
    expect(Buffer.concat(chunks).toString()).toBe('a,b');
  });
});
