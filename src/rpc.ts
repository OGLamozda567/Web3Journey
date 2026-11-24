import { fetchWithRetry, hexWeiToEth, readJsonBody, sleep } from "./util.js";

let rpcId = 0;

export async function rpcCall(rpcUrl: string, method: string, params: unknown[]): Promise<unknown> {
  const res = await fetchWithRetry(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++rpcId, method, params }),
  });
  if (!res.ok) throw new Error(`RPC ${method} gagal: HTTP ${res.status}`);
  const body = (await readJsonBody(res)) as { result?: unknown; error?: { message?: string } };
  if (body.error) throw new Error(`RPC ${method} error: ${body.error.message ?? "unknown"}`);
  return body.result;
}

export async function getBalanceEth(rpcUrl: string, address: string): Promise<string> {
  const result = await rpcCall(rpcUrl, "eth_getBalance", [address, "latest"]);
  return hexWeiToEth(result as string);
}

export interface WaitOptions {
  timeoutMs?: number;
  intervalMs?: number;
}

export async function waitForConfirmation(rpcUrl: string, txHash: string, opts: WaitOptions = {}): Promise<boolean> {
  const timeoutMs = opts.timeoutMs ?? 120_000;
  const intervalMs = opts.intervalMs ?? 5_000;
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const receipt = (await rpcCall(rpcUrl, "eth_getTransactionReceipt", [txHash])) as { status?: string } | null;
    if (receipt) return receipt.status !== "0x0";
    await sleep(intervalMs);
  }
  return false;
}
