import { cooldownHoursFromEnv } from "./config.js";
import { NETWORK_IDS, NETWORKS, resolveRpcUrl } from "./networks.js";
import { claimFromFaucet } from "./claim.js";
import { ALL_FAUCETS, configuredFaucets, findFaucet } from "./faucets/index.js";
import { getBalanceEth } from "./rpc.js";
import { readClaims } from "./ledger.js";
import { isAddress, log } from "./util.js";
import type { FaucetToken, NetworkId } from "./types.js";

const TOKENS: FaucetToken[] = ["eth", "usdc", "eurc", "cbbtc"];

type Flags = Record<string, string | boolean>;

function parseArgs(argv: string[]): { command: string; flags: Flags } {
  const flags: Flags = {};
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const eq = arg.indexOf("=");
      if (eq !== -1) {
        flags[arg.slice(2, eq)] = arg.slice(eq + 1);
      } else if (i + 1 < argv.length && !argv[i + 1].startsWith("--")) {
        flags[arg.slice(2)] = argv[++i];
      } else {
        flags[arg.slice(2)] = true;
      }
    } else {
      positional.push(arg);
    }
  }
  return { command: positional[0] ?? "help", flags };
}

const strFlag = (flags: Flags, name: string, dflt?: string): string | undefined =>
  typeof flags[name] === "string" ? (flags[name] as string) : dflt;

const boolFlag = (flags: Flags, name: string): boolean =>
  flags[name] === true || flags[name] === "true";

function resolveNetworks(flags: Flags): NetworkId[] | null {
  const raw = strFlag(flags, "network");
  if (!raw) {
    log.err("--network wajib diisi: sepolia | base-sepolia | all");
    return null;
  }
  if (raw === "all") return NETWORK_IDS;
  if (raw === "sepolia" || raw === "base-sepolia") return [raw];
  log.err(`--network tidak dikenal: ${raw} (sepolia | base-sepolia | all)`);
  return null;
}

function resolveAddress(flags: Flags): string | null {
  const address = strFlag(flags, "address");
  if (!address || !isAddress(address)) {
    log.err("--address wajib berupa alamat EVM yang valid, contoh: 0x1234...abcd (0x + 40 hex)");
    return null;
  }
  return address;
}

async function cmdClaim(flags: Flags): Promise<number> {
  const networks = resolveNetworks(flags);
  if (!networks) return 1;
  const address = resolveAddress(flags);
  if (!address) return 1;

  const token = strFlag(flags, "token", "eth") as FaucetToken;
  if (!TOKENS.includes(token)) {
    log.err(`--token tidak valid: ${token}. Pilihan: ${TOKENS.join(", ")}`);
    return 1;
  }

  const faucetFlag = strFlag(flags, "faucet", "all")!;
  const dryRun = boolFlag(flags, "dry-run");
  let faucets;
  if (faucetFlag === "all") {
    faucets = dryRun ? ALL_FAUCETS : configuredFaucets();
    if (faucets.length === 0) {
      log.err("Tidak ada faucet yang terkonfigurasi. Isi .env dengan CDP_API_KEY_ID + CDP_API_KEY_SECRET, atau CUSTOM_FAUCET_URL untuk custom faucet.");
      return 1;
    }
  } else {
    const faucet = findFaucet(faucetFlag);
    if (!faucet) {
      log.err(`Faucet tidak dikenal: ${faucetFlag}. Tersedia: cdp, custom (atau 'all')`);
      return 1;
    }
    if (!dryRun && !faucet.isConfigured()) {
      log.err(`Faucet "${faucet.name}" belum terkonfigurasi. ${faucet.description}`);
      return 1;
    }
    faucets = [faucet];
  }

  const cooldownRaw = strFlag(flags, "cooldown-hours");
  const cooldownHours = cooldownRaw !== undefined ? Number(cooldownRaw) : cooldownHoursFromEnv();
  if (!Number.isFinite(cooldownHours) || cooldownHours < 0) {
    log.err("--cooldown-hours harus berupa angka >= 0");
    return 1;
  }

  const opts = {
    dryRun,
    force: boolFlag(flags, "force"),
    wait: boolFlag(flags, "wait"),
    cooldownHours,
    token,
  };

  const outcomes = [];
  for (const network of networks) {
    for (const faucet of faucets) {
      if (!faucet.networks.includes(network)) continue;
      outcomes.push(await claimFromFaucet(network, faucet, address, opts));
    }
  }
  const succeeded = outcomes.filter((o) => o.ok && !o.skipped).length;
  const skipped = outcomes.filter((o) => o.skipped).length;
  const failed = outcomes.filter((o) => !o.ok && !o.skipped).length;
  log.info(`Selesai: ${succeeded} berhasil, ${skipped} dilewati (cooldown), ${failed} gagal`);
  return failed > 0 ? 1 : 0;
}

async function cmdBalance(flags: Flags): Promise<number> {
  const networks = resolveNetworks(flags);
  if (!networks) return 1;
  const address = resolveAddress(flags);
  if (!address) return 1;
  let failed = 0;
  for (const network of networks) {
    const def = NETWORKS[network];
    try {
      const balance = await getBalanceEth(resolveRpcUrl(def), address);
      log.info(`${def.label} (${def.id}, chainId ${def.chainId}) — saldo ${address}: ${balance} ETH`);
    } catch (err) {
      failed++;
      log.err(`Gagal cek saldo di ${def.label}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return failed > 0 ? 1 : 0;
}

function cmdHistory(flags: Flags): number {
  const networkFilter = strFlag(flags, "network");
  const addressFilter = strFlag(flags, "address")?.toLowerCase();
  const limit = Number(strFlag(flags, "limit", "20"));
  const entries = readClaims()
    .filter((c) => !networkFilter || c.network === networkFilter)
    .filter((c) => !addressFilter || c.address.toLowerCase() === addressFilter)
    .slice(-(Number.isFinite(limit) && limit > 0 ? limit : 20));
  if (entries.length === 0) {
    log.info("Belum ada riwayat claim.");
    return 0;
  }
  for (const e of entries) {
    const tx = e.txHash ?? "-";
    const err = e.error ? ` | error: ${e.error.slice(0, 120)}` : "";
    console.log(`${e.at} | ${e.network} | ${e.faucet} | ${e.token} | ${e.status} | ${tx} | ${e.address}${err}`);
  }
  return 0;
}

function cmdNetworks(): number {
  for (const def of Object.values(NETWORKS)) {
    console.log(`${def.id} | ${def.label} | chainId ${def.chainId} | rpc ${resolveRpcUrl(def)}`);
  }
  return 0;
}

function printHelp(): void {
  console.log(`faucet-claimer — klaim testnet ETH dari faucet Sepolia & Base Sepolia

Pemakaian:
  npm run dev -- claim --network <sepolia|base-sepolia|all> --address <0x...> [opsi]
  npm run dev -- balance --network <sepolia|base-sepolia|all> --address <0x...>
  npm run dev -- history [--network <id>] [--address <0x...>] [--limit N]
  npm run dev -- networks

Opsi claim:
  --faucet <cdp|custom|all>   faucet yang dipakai (default: all yang terkonfigurasi)
  --token <eth|usdc|eurc|cbbtc>  token yang di-claim (default: eth)
  --dry-run                   hanya cetak request yang akan dikirim, tanpa eksekusi
  --force                     lewati pengecekan cooldown lokal
  --cooldown-hours <N>        cooldown per (network, faucet, address); 0 = nonaktif (default: dari COOLDOWN_HOURS / 12)
  --wait                      tunggu sampai tx terkonfirmasi on-chain

Konfigurasi via .env (lihat .env.example):
  CDP_API_KEY_ID, CDP_API_KEY_SECRET   untuk faucet CDP (ethereum-sepolia & base-sepolia)
  CUSTOM_FAUCET_URL, CUSTOM_FAUCET_METHOD, CUSTOM_FAUCET_HEADERS, CUSTOM_FAUCET_BODY
                                       untuk faucet HTTP kustom, body mendukung {{address}}, {{network}}, {{chainId}}, {{token}}
  SEPOLIA_RPC_URL, BASE_SEPOLIA_RPC_URL untuk override RPC
  LEDGER_PATH                          lokasi file riwayat claim`);
}

export async function runCli(argv: string[]): Promise<number> {
  const { command, flags } = parseArgs(argv);
  switch (command) {
    case "claim":
      return cmdClaim(flags);
    case "balance":
      return cmdBalance(flags);
    case "history":
      return cmdHistory(flags);
    case "networks":
      return cmdNetworks();
    case "help":
    case "--help":
    case "-h":
      printHelp();
      return 0;
    default:
      log.err(`Perintah tidak dikenal: ${command}`);
      printHelp();
      return 1;
  }
}
