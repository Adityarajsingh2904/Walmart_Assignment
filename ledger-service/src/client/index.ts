/* istanbul ignore file */
import type { Contract } from '@hyperledger/fabric-gateway'
import logger from '../logger'
import { SoarActionEvent } from '../models/event'

class FabricClient {
  // In a future phase this will connect to Fabric Gateway
  private contract: Contract | undefined

  async logEvent(event: SoarActionEvent): Promise<void> {
    logger.info({ event }, 'logEvent')
    // placeholder for chaincode invoke
  }

  async verify(runId: string): Promise<boolean> {
    logger.info({ runId }, 'verify')
    return true
  }

  async getEvents(): Promise<SoarActionEvent[]> {
    logger.info('getEvents')
    return []
  }
}

export default new FabricClient()
