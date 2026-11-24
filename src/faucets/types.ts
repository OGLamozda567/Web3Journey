import type { FaucetToken, NetworkId } from "../types.js";

export interface FaucetClaimResult {
  txHash: string | null;
  detail: unknown;
}

export interface FaucetAdapter {
  name: string;
  description: string;
  networks: readonly NetworkId[];
  isConfigured(): boolean;
  claim(network: NetworkId, address: string, token: FaucetToken, dryRun: boolean): Promise<FaucetClaimResult>;
}
