import { customFaucetConfig } from "../config.js";
import { NETWORKS } from "../networks.js";
import { fetchWithRetry, readJsonBody } from "../util.js";
import type { FaucetToken, NetworkId } from "../types.js";
import type { FaucetAdapter, FaucetClaimResult } from "./types.js";

function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => vars[key] ?? "");
}

function extractTxHash(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const obj = body as Record<string, unknown>;
  for (const key of ["txHash", "transactionHash", "tx_hash", "hash", "tx"]) {
    const value = obj[key];
    if (typeof value === "string" && /^0x[a-fA-F0-9]{64}$/.test(value)) return value;
  }
  for (const key of ["data", "result"]) {
    const nested = extractTxHash(obj[key]);
    if (nested) return nested;
  }
  return null;
}

export const customFaucet: FaucetAdapter = {
  name: "custom",
  description: "Custom HTTP faucet — butuh CUSTOM_FAUCET_URL (dan opsional CUSTOM_FAUCET_METHOD/HEADERS/BODY)",
  networks: ["sepolia", "base-sepolia"],
  isConfigured(): boolean {
    return customFaucetConfig() !== null;
  },
  async claim(network: NetworkId, address: string, token: FaucetToken, dryRun: boolean): Promise<FaucetClaimResult> {
    const cfg = customFaucetConfig();
    if (!cfg) throw new Error("Custom faucet memerlukan CUSTOM_FAUCET_URL di .env");
    const def = NETWORKS[network];
    const vars: Record<string, string> = {
      address,
      network: def.id,
      chainId: String(def.chainId),
      token,
    };
    const body = fillTemplate(cfg.bodyTemplate, vars);
    if (dryRun) {
      return { txHash: null, detail: { method: cfg.method, url: cfg.url, headers: cfg.headers, body } };
    }
    const res = await fetchWithRetry(cfg.url, {
      method: cfg.method,
      headers: cfg.headers,
      body: cfg.method === "GET" || cfg.method === "HEAD" ? undefined : body,
    });
    const json = await readJsonBody(res);
    if (!res.ok) {
      throw new Error(`Custom faucet merespons HTTP ${res.status}: ${JSON.stringify(json).slice(0, 300)}`);
    }
    return { txHash: extractTxHash(json), detail: json };
  },
};
