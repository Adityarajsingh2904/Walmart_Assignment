export interface BackoffOpts {
  retries?: number;
  base?: number;
  factor?: number;
  max?: number;
}

export async function exponentialBackoff<T>(fn: () => Promise<T>, opts: BackoffOpts = {}): Promise<T> {
  const { retries = 5, base = 200, factor = 1.8, max = 10000 } = opts;
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err) {
      attempt++;
      if (attempt > retries) {
        throw err;
      }
      const delay = Math.min(max, Math.round(base * Math.pow(factor, attempt - 1)));
      await new Promise(res => setTimeout(res, delay));
    }
  }
}
