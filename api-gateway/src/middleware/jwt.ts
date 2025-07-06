import { Request, Response, NextFunction } from 'express'
import jwksRsa from 'jwks-rsa'
import jwt from 'jsonwebtoken'
import config from '../config'

const client = jwksRsa({ jwksUri: config.jwksUri })

function getKey(header: jwt.JwtHeader, callback: jwt.SigningKeyCallback) {
  client.getSigningKey(header.kid as string, (err, key) => {
    const signingKey = key ? key.getPublicKey() : null
    callback(err, signingKey as jwt.Secret)
  })
}

export interface AuthedRequest extends Request {
  user?: unknown
}

export function jwtMiddleware(req: AuthedRequest, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) return res.status(401).send('Unauthorized')
  jwt.verify(
    token,
    getKey,
    {
      audience: config.jwtAudience,
      algorithms: ['RS256']
    },
    (err: jwt.VerifyErrors | null, decoded: unknown) => {
      if (err) return res.status(401).send('Unauthorized')
      req.user = decoded
      next()
    }
  )
}
