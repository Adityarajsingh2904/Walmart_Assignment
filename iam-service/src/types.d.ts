declare module '@trustvault/jwt' {
  export function verify(token: string): Promise<any>;
}

declare module 'json-logic-js' {
  export function apply(rule: any, data: any): any;
}
