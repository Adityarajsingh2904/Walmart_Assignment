/**
 * Example for retrieving metrics.
 *
 * npm install @trustvault/sdk
 */
import { TrustVaultClient } from '@trustvault/sdk'

const client = new TrustVaultClient({
  baseUrl: 'https://api.trustvault.io',
  token: process.env.TOKEN ?? '',
})

export async function getMetrics(): Promise<void> {
  const metrics = await client.get<Record<string, number>>('/api/metrics')
  console.log(metrics)
}

getMetrics().catch(console.error)
