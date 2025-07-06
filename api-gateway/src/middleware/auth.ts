import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import dotenv from 'dotenv'

dotenv.config()

const JwtPayload = z.object({
  id: z.string().uuid(),
  roles: z.array(z.string()),
  tenant_id: z.string().uuid(),
  iat: z.number(),
  exp: z.number(),
  nbf: z.number().optional()
})

export type JwtPayloadType = z.infer<typeof JwtPayload>

export interface AuthOptions {
  clockSkew?: number
}

export default function jwtAuth(options: AuthOptions = {}) {
  const clockSkew = options.clockSkew ?? 30
  const secret = process.env.JWT_SECRET
  return function (req: Request, res: Response, next: NextFunction) {
    const header = req.header('Authorization')
    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
    const token = header.slice(7)
    try {
      const decoded = jwt.verify(token, secret ?? '', {
        algorithms: ['HS256'],
        clockTolerance: clockSkew
      })
      const parsed = JwtPayload.safeParse(decoded)
      if (!parsed.success) {
        throw new Error('invalid payload')
      }
      req.user = {
        id: parsed.data.id,
        roles: parsed.data.roles,
        tenant_id: parsed.data.tenant_id
      }
      return next()
    } catch {
      return res.status(401).json({ error: 'Unauthorized' })
    }
  }
}
