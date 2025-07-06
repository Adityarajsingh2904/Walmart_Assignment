import dotenv from 'dotenv'

dotenv.config()

const envMap = {
  alerts: 'ALERTS_URL',
  sessions: 'IAM_URL',
  users: 'IAM_URL',
  soar: 'SOAR_URL',
  ledger: 'LEDGER_URL'
} as const

export type ServiceName = keyof typeof envMap

export function getServiceUrl(name: ServiceName): string {
  return process.env[envMap[name]] || ''
}

export const services: Record<ServiceName, string> = {
  alerts: getServiceUrl('alerts'),
  sessions: getServiceUrl('sessions'),
  users: getServiceUrl('users'),
  soar: getServiceUrl('soar'),
  ledger: getServiceUrl('ledger')
}

export default services
