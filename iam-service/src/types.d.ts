interface JwtPayload {
  sub: string;
  jti: string;
  iat: number;
  exp: number;
  roles: string[];
  attrs: Record<string, string>;
  tenant_id: string;
}

declare module '@trustvault/jwt' {
  export function issueJwt(
    userId: string,
    roles: string[],
    attrs: Record<string, string>,
    tenantId: string,
  ): Promise<{ access: string; refresh: string }>;
  export function validateJwt(
    token: string,
  ): Promise<
    | { valid: true; payload: JwtPayload }
    | { valid: false; error: string }
  >;
  export function attachJwt(app: import('express').Express): void;
  export function rotateKeys(): Promise<void>;
  export function revokeToken(jti: string, ttl: number): Promise<void>;
  export function sign(payload: import('jose').JWTPayload): Promise<string>;
  export function verify(token: string): Promise<JwtPayload>;
}

declare module 'speakeasy';

declare module 'json-logic-js' {
  export function apply(rule: any, data: any): any;
}

declare module 'structlog' {
  export const logger: { info: (...args: any[]) => void };
}

declare namespace Express {
  interface Request {
    user?: any;
  }
}
