import { CdpClient } from "@coinbase/cdp-sdk";
import { NETWORKS } from "../networks.js";
import type { FaucetToken, NetworkId } from "../types.js";
import type { FaucetAdapter, FaucetClaimResult } from "./types.js";

export const cdpFaucet: FaucetAdapter = {
  name: "cdp",
  description: "CDP Faucet API — butuh CDP_API_KEY_ID + CDP_API_KEY_SECRET (portal.cdp.coinbase.com)",
  networks: ["sepolia", "base-sepolia"],
  isConfigured(): boolean {
    return Boolean(process.env.CDP_API_KEY_ID && process.env.CDP_API_KEY_SECRET);
  },
  async claim(network: NetworkId, address: string, token: FaucetToken, dryRun: boolean): Promise<FaucetClaimResult> {
    const def = NETWORKS[network];
    if (dryRun) {
      return {
        txHash: null,
        detail: { faucet: "cdp", cdpNetwork: def.cdpNetwork, chainId: def.chainId, address, token },
      };
    }
    if (!cdpFaucet.isConfigured()) {
      throw new Error("Faucet CDP memerlukan CDP_API_KEY_ID dan CDP_API_KEY_SECRET di .env");
    }
    const client = new CdpClient();
    const result = await client.evm.requestFaucet({
      address,
      network: def.cdpNetwork,
      token,
      idempotencyKey: crypto.randomUUID(),
    });
    return { txHash: result.transactionHash, detail: result };
  },
};
