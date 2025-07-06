declare module '@trustvault/jwt' {
  export function verify(token: string): Promise<any>;
  export function sign(payload: any): Promise<string>;
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
