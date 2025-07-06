import { config } from 'dotenv-flow'
config()

export interface Env {
  FABRIC_CONNECTION_PROFILE: string
  FABRIC_WALLET_PATH: string
  FABRIC_IDENTITY: string
  CHANNEL_NAME: string
  CONTRACT_NAME: string
  PORT: number
  METRICS_PORT: number
  LOG_LEVEL: string
}

const env: Env = {
  FABRIC_CONNECTION_PROFILE: process.env.FABRIC_CONNECTION_PROFILE || './fabric/connection.json',
  FABRIC_WALLET_PATH: process.env.FABRIC_WALLET_PATH || './wallet',
  FABRIC_IDENTITY: process.env.FABRIC_IDENTITY || 'appUser',
  CHANNEL_NAME: process.env.CHANNEL_NAME || 'trustvault',
  CONTRACT_NAME: process.env.CONTRACT_NAME || 'ledger',
  PORT: Number(process.env.PORT) || 8084,
  METRICS_PORT: Number(process.env.METRICS_PORT) || 8003,
  LOG_LEVEL: process.env.LOG_LEVEL || 'info'
}

export default env
