/**
 * Example of interacting with the TrustVault alerts API.
 *
 * npm install @trustvault/sdk
 */
import { TrustVaultClient } from '@trustvault/sdk'

const client = new TrustVaultClient({
  baseUrl: 'https://api.trustvault.io',
  token: process.env.TOKEN ?? '',
})

interface AlertInput {
  message: string
  severity: 'info' | 'warning' | 'critical'
}

export async function createAlert(input: AlertInput): Promise<void> {
  const alert = await client.post<{ id: string }>('/api/alerts', input)
  console.log('Created alert', alert.id)
}

export async function listAlerts(): Promise<void> {
  const alerts = await client.get<Array<{ id: string; message: string }>>('/api/alerts')
  alerts.forEach((a) => console.log(`${a.id}: ${a.message}`))
}
