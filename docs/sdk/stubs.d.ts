declare module '@trustvault/sdk' {
  export interface TrustVaultClientConfig {
    baseUrl: string
    token?: string
  }

  export class TrustVaultClient {
    constructor(config: TrustVaultClientConfig)
    get<T>(path: string): Promise<T>
    post<T>(path: string, body?: unknown): Promise<T>
  }
}
