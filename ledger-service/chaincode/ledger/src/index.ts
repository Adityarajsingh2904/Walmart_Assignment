import { Contract } from 'fabric-contract-api'
import { LedgerContract } from './ledger_contract'

export const contracts: typeof Contract[] = [LedgerContract]
