import { NETWORKS, resolveRpcUrl } from "./networks.js";
import { appendClaim, isWithinCooldown, lastClaimFor, updateLastClaim } from "./ledger.js";
import { waitForConfirmation } from "./rpc.js";
import { log } from "./util.js";
import type { ClaimOptions, ClaimOutcome, NetworkId } from "./types.js";
import type { FaucetAdapter } from "./faucets/types.js";

export async function claimFromFaucet(
  network: NetworkId,
  faucet: FaucetAdapter,
  address: string,
  opts: ClaimOptions,
): Promise<ClaimOutcome> {
  const def = NETWORKS[network];
  const base: ClaimOutcome = {
    ok: false,
    skipped: false,
    network,
    faucet: faucet.name,
    address,
    txHash: null,
    explorerUrl: null,
    dryRun: opts.dryRun,
    error: null,
  };

  const last = lastClaimFor(network, faucet.name, address);
  if (!opts.force && isWithinCooldown(last, opts.cooldownHours)) {
    base.skipped = true;
    base.ok = true;
    log.warn(`Lewati ${faucet.name} @ ${def.label}: masih dalam cooldown (claim terakhir ${last?.at})`);
    return base;
  }

  try {
    const result = await faucet.claim(network, address, opts.token, opts.dryRun);
    if (opts.dryRun) {
      log.info(`[dry-run] ${faucet.name} @ ${def.label} akan mengirim: ${JSON.stringify(result.detail)}`);
      base.ok = true;
      return base;
    }

    base.txHash = result.txHash;
    base.explorerUrl = result.txHash ? def.explorerTx(result.txHash) : null;
    appendClaim({
      at: new Date().toISOString(),
      network,
      faucet: faucet.name,
      address,
      token: opts.token,
      txHash: result.txHash,
      status: "requested",
      dryRun: false,
    });

    if (result.txHash) {
      log.ok(`Claim ${faucet.name} @ ${def.label} terkirim, tx: ${result.txHash}`);
      log.info(`Explorer: ${base.explorerUrl}`);
      if (opts.wait) {
        log.info("Menunggu konfirmasi on-chain...");
        const confirmed = await waitForConfirmation(resolveRpcUrl(def), result.txHash);
        updateLastClaim({ status: confirmed ? "confirmed" : "requested" });
        if (confirmed) log.ok(`Terkonfirmasi di ${def.label}: ${result.txHash}`);
        else log.warn("Belum terkonfirmasi dalam batas waktu tunggu");
      }
    } else {
      log.ok(`Claim ${faucet.name} @ ${def.label} diterima (faucet tidak mengembalikan txHash)`);
    }
    base.ok = true;
    return base;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    appendClaim({
      at: new Date().toISOString(),
      network,
      faucet: faucet.name,
      address,
      token: opts.token,
      txHash: null,
      status: "failed",
      dryRun: opts.dryRun,
      error: message,
    });
    base.error = message;
    log.err(`Claim ${faucet.name} @ ${def.label} gagal: ${message}`);
    return base;
  }
}
