import 'express'

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string
        roles: string[]
        tenant_id: string
      }
    }
  }
}

export {}
