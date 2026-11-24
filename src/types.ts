export type NetworkId = "sepolia" | "base-sepolia";
export type CdpNetwork = "ethereum-sepolia" | "base-sepolia";
export type FaucetToken = "eth" | "usdc" | "eurc" | "cbbtc";

export interface NetworkDef {
  id: NetworkId;
  label: string;
  chainId: number;
  cdpNetwork: CdpNetwork;
  defaultRpcUrl: string;
  rpcEnvVar: string;
  explorerTx: (hash: string) => string;
}

export interface ClaimOutcome {
  ok: boolean;
  skipped: boolean;
  network: NetworkId;
  faucet: string;
  address: string;
  txHash: string | null;
  explorerUrl: string | null;
  dryRun: boolean;
  error: string | null;
}

export interface LedgerEntry {
  at: string;
  network: NetworkId;
  faucet: string;
  address: string;
  token: string;
  txHash: string | null;
  status: "requested" | "confirmed" | "failed" | "dry-run";
  dryRun: boolean;
  error?: string;
}

export interface ClaimOptions {
  dryRun: boolean;
  force: boolean;
  cooldownHours: number;
  wait: boolean;
  token: FaucetToken;
}
