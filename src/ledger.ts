import fs from "node:fs";
import path from "node:path";
import { ledgerPath } from "./config.js";
import type { LedgerEntry, NetworkId } from "./types.js";

interface LedgerFile {
  claims: LedgerEntry[];
}

function load(): LedgerFile {
  try {
    const parsed = JSON.parse(fs.readFileSync(ledgerPath(), "utf8")) as LedgerFile;
    if (Array.isArray(parsed.claims)) return parsed;
  } catch {
    // ledger belum ada atau belum bisa dibaca
  }
  return { claims: [] };
}

export function readClaims(): LedgerEntry[] {
  return load().claims;
}

export function saveClaims(entries: LedgerEntry[]): void {
  const file = ledgerPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ claims: entries }, null, 2) + "\n");
}

export function appendClaim(entry: LedgerEntry): void {
  const all = load().claims;
  all.push(entry);
  saveClaims(all);
}

export function updateLastClaim(patch: Partial<LedgerEntry>): void {
  const all = load().claims;
  const last = all[all.length - 1];
  if (last) Object.assign(last, patch);
  saveClaims(all);
}

export function lastClaimFor(network: NetworkId, faucet: string, address: string): LedgerEntry | undefined {
  const addr = address.toLowerCase();
  return load()
    .claims.filter(
      (c) =>
        c.network === network &&
        c.faucet === faucet &&
        c.address.toLowerCase() === addr &&
        (c.status === "requested" || c.status === "confirmed"),
    )
    .at(-1);
}

export function isWithinCooldown(entry: LedgerEntry | undefined, cooldownHours: number): boolean {
  if (!entry || cooldownHours <= 0) return false;
  return Date.now() - new Date(entry.at).getTime() < cooldownHours * 3_600_000;
}
