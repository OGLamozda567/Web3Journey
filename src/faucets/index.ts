import { cdpFaucet } from "./cdp.js";
import { customFaucet } from "./http.js";
import type { FaucetAdapter } from "./types.js";

export const ALL_FAUCETS: FaucetAdapter[] = [cdpFaucet, customFaucet];

export function configuredFaucets(): FaucetAdapter[] {
  return ALL_FAUCETS.filter((f) => f.isConfigured());
}

export function findFaucet(name: string): FaucetAdapter | undefined {
  return ALL_FAUCETS.find((f) => f.name === name);
}
