import type { NetworkDef, NetworkId } from "./types.js";

export const NETWORKS: Record<NetworkId, NetworkDef> = {
  sepolia: {
    id: "sepolia",
    label: "Ethereum Sepolia",
    chainId: 11155111,
    cdpNetwork: "ethereum-sepolia",
    defaultRpcUrl: "https://ethereum-sepolia-rpc.publicnode.com",
    rpcEnvVar: "SEPOLIA_RPC_URL",
    explorerTx: (hash) => `https://sepolia.etherscan.io/tx/${hash}`,
  },
  "base-sepolia": {
    id: "base-sepolia",
    label: "Base Sepolia",
    chainId: 84532,
    cdpNetwork: "base-sepolia",
    defaultRpcUrl: "https://sepolia.base.org",
    rpcEnvVar: "BASE_SEPOLIA_RPC_URL",
    explorerTx: (hash) => `https://sepolia.basescan.org/tx/${hash}`,
  },
};

export const NETWORK_IDS = Object.keys(NETWORKS) as NetworkId[];

export function resolveRpcUrl(network: NetworkDef): string {
  return process.env[network.rpcEnvVar] || network.defaultRpcUrl;
}
