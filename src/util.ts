export const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export function isAddress(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

export function hexWeiToEth(hex: string): string {
  const wei = BigInt(hex);
  const whole = wei / 10n ** 18n;
  const frac = (wei % 10n ** 18n).toString().padStart(18, "0").slice(0, 6).replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : `${whole}`;
}

const timestamp = (): string => new Date().toISOString();

export const log = {
  info: (msg: string): void => console.log(`[${timestamp()}] ${msg}`),
  ok: (msg: string): void => console.log(`[${timestamp()}] OK  ${msg}`),
  warn: (msg: string): void => console.log(`[${timestamp()}] WARN ${msg}`),
  err: (msg: string): void => console.error(`[${timestamp()}] ERR  ${msg}`),
};

export interface RetryOptions {
  retries?: number;
  baseDelayMs?: number;
}

export async function fetchWithRetry(url: string, init: RequestInit, opts: RetryOptions = {}): Promise<Response> {
  const retries = opts.retries ?? 3;
  const baseDelayMs = opts.baseDelayMs ?? 1000;
  let lastError: unknown = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, init);
      if ((res.status === 429 || res.status >= 500) && attempt < retries) {
        const retryAfterSec = Number(res.headers.get("retry-after"));
        const delay = Number.isFinite(retryAfterSec) && retryAfterSec > 0 ? retryAfterSec * 1000 : baseDelayMs * 2 ** attempt;
        log.warn(`${url} merespons HTTP ${res.status}, mencoba lagi ${attempt + 1}/${retries} dalam ${Math.round(delay / 1000)}s`);
        await sleep(delay);
        continue;
      }
      return res;
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        await sleep(baseDelayMs * 2 ** attempt);
        continue;
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export async function readJsonBody(res: Response): Promise<unknown> {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { raw: text };
  }
}
