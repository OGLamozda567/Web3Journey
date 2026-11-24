import fs from "node:fs";
import path from "node:path";

export function loadEnvFile(filePath = ".env"): void {
  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs)) return;
  for (const rawLine of fs.readFileSync(abs, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
      (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

export function cooldownHoursFromEnv(): number {
  const raw = process.env.COOLDOWN_HOURS;
  const n = raw === undefined || raw === "" ? 12 : Number(raw);
  if (!Number.isFinite(n) || n < 0) throw new Error("COOLDOWN_HOURS harus berupa angka >= 0");
  return n;
}

export interface CustomFaucetConfig {
  url: string;
  method: string;
  headers: Record<string, string>;
  bodyTemplate: string;
}

export function customFaucetConfig(): CustomFaucetConfig | null {
  const url = process.env.CUSTOM_FAUCET_URL;
  if (!url) return null;
  let headers: Record<string, string> = { "Content-Type": "application/json" };
  if (process.env.CUSTOM_FAUCET_HEADERS) {
    try {
      headers = { ...headers, ...(JSON.parse(process.env.CUSTOM_FAUCET_HEADERS) as Record<string, string>) };
    } catch {
      throw new Error("CUSTOM_FAUCET_HEADERS bukan JSON yang valid");
    }
  }
  return {
    url,
    method: (process.env.CUSTOM_FAUCET_METHOD || "POST").toUpperCase(),
    headers,
    bodyTemplate: process.env.CUSTOM_FAUCET_BODY || JSON.stringify({ address: "{{address}}" }),
  };
}

export function ledgerPath(): string {
  return process.env.LEDGER_PATH || path.join(process.cwd(), "data", "claims.json");
}
