/* istanbul ignore file */
import type { Contract } from '@hyperledger/fabric-gateway'
import logger from '../logger'
import { SoarActionEvent } from '../models/event'

class FabricClient {
  // In a future phase this will connect to Fabric Gateway
  private contract: Contract | undefined

  async logEvent(event: SoarActionEvent): Promise<void> {
    logger.info('logEvent', { event })
    // placeholder for chaincode invoke
  }

  async verify(runId: string): Promise<boolean> {
    logger.info('verify', { runId })
    return true
  }

  async getEvents(): Promise<SoarActionEvent[]> {
    logger.info('getEvents')
    return []
  }
}

export default new FabricClient()
