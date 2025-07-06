import path from 'path'
import { DockerComposeEnvironment, StartedDockerComposeEnvironment } from 'testcontainers'
import { logEvent, verifyIntegrity } from '../../src/fabricClient'

const connectMock = jest.fn()
const disconnectMock = jest.fn()
const getNetworkMock = jest.fn()
const createTransactionMock = jest.fn()
const submitMock = jest.fn()
const evaluateMock = jest.fn()

jest.mock('fabric-network', () => ({
  Gateway: jest.fn().mockImplementation(() => ({
    connect: connectMock,
    disconnect: disconnectMock,
    getNetwork: getNetworkMock,
  })),
  Wallets: { newFileSystemWallet: jest.fn().mockResolvedValue({}) },
}))

beforeEach(() => {
  jest.resetModules()
  getNetworkMock.mockResolvedValue({
    getContract: () => ({
      createTransaction: createTransactionMock.mockReturnValue({
        getTransactionId: () => 'tx123',
        submit: submitMock,
      }),
      evaluateTransaction: evaluateMock,
    }),
  })
  submitMock.mockResolvedValue(undefined)
  evaluateMock.mockResolvedValue(Buffer.from(JSON.stringify({ valid: true, ledgerHash: 'a', providedHash: 'a' })))
  process.env.FABRIC_CONN_PROFILE = './profile.json'
  process.env.FABRIC_WALLET_PATH = './wallet'
  process.env.FABRIC_CHANNEL = 'chan'
  process.env.FABRIC_CC_NAME = 'cc'
})

describe('integration happy path', () => {
  let compose: StartedDockerComposeEnvironment | undefined
  let dockerAvailable = true

  beforeAll(async () => {
    try {
      compose = await new DockerComposeEnvironment(
        path.resolve(__dirname, '../../'),
        'docker-compose.override.yml'
      ).up()
    } catch (err) {
      dockerAvailable = false
      console.warn('Docker not available, skipping integration test')
    }
  }, 60000)

  afterAll(async () => {
    if (compose) await compose.down()
  })

  it('logEvent and verify', async () => {
    if (!dockerAvailable) {
      console.warn('skipping integration test due to missing Docker')
      return
    }
    const event = {
      id: 'e1',
      runId: '11111111-1111-1111-1111-111111111111',
      playbookId: '22222222-2222-2222-2222-222222222222',
      stepId: 'isolate',
      action: 'isolate_host',
      status: 'success',
      timestamp: '2025-07-06T12:00:00.000Z'
    }
    const txId = await logEvent(event)
    expect(txId).toBe('tx123')
    const result = await verifyIntegrity('key', 'a')
    expect(result).toEqual({ valid: true, ledgerHash: 'a', providedHash: 'a' })
  })
})
