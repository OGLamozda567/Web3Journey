# faucet-claimer

CLI (Node.js + TypeScript) untuk claim testnet ETH dari faucet **Ethereum Sepolia** dan **Base Sepolia**.

## Fitur

- Claim via **CDP Faucet API** (Coinbase Developer Platform) — mendukung `ethereum-sepolia` dan `base-sepolia`, token `eth`/`usdc`/`eurc`/`cbbtc`
- Claim via **custom HTTP faucet** mana pun yang punya endpoint API terbuka (dikonfigurasi via env, body mendukung placeholder `{{address}}`, `{{network}}`, `{{chainId}}`, `{{token}}`)
- Cek saldo via RPC publik (`eth_getBalance`)
- Opsional menunggu konfirmasi on-chain (`--wait`)
- Ledger lokal (`data/claims.json`) + cooldown per (network, faucet, address) supaya tidak spam faucet
- Retry otomatis dengan backoff untuk HTTP 429/5xx
- `--dry-run` untuk preview request tanpa eksekusi

## Setup

```bash
npm install
cp .env.example .env
# isi .env: CDP_API_KEY_ID + CDP_API_KEY_SECRET dari https://portal.cdp.coinbase.com/api-keys
# (atau konfigurasi CUSTOM_FAUCET_* untuk custom faucet)
```

Butuh Node.js >= 20.

## Pemakaian

```bash
# claim ETH di Sepolia (semua faucet yang terkonfigurasi)
npm run dev -- claim --network sepolia --address 0xAlamatKamu

# claim di Base Sepolia, faucet CDP saja, token USDC, tunggu konfirmasi
npm run dev -- claim --network base-sepolia --address 0xAlamatKamu --faucet cdp --token usdc --wait

# claim di semua network sekaligus
npm run dev -- claim --network all --address 0xAlamatKamu

# claim untuk beberapa alamat sekaligus (cooldown/ledger tetap dihitung per alamat)
# bisa dipisah koma, diulang, atau dari file (satu alamat per baris, '#' = komentar):
npm run dev -- claim --network all --address 0xAlamatA,0xAlamatB --wait
printf '0xAlamatA\n0xAlamatB\n' > alamat.txt
npm run dev -- claim --network sepolia --addresses-file alamat.txt

# preview request tanpa mengirim apa pun
npm run dev -- claim --network all --address 0xAlamatKamu --dry-run

# lewati cooldown lokal / pakai cooldown custom
npm run dev -- claim --network sepolia --address 0xAlamatKamu --force
npm run dev -- claim --network sepolia --address 0xAlamatKamu --cooldown-hours 24

# cek saldo (mendukung banyak alamat juga)
npm run dev -- balance --network all --address 0xAlamatA,0xAlamatB

# riwayat claim
npm run dev -- history --limit 10

# daftar network & RPC yang dipakai
npm run dev -- networks
```

Setelah build (`npm run build`), jalankan versi compiled dengan `node dist/index.js ...`.

## Custom faucet (endpoint HTTP sendiri)

```bash
CUSTOM_FAUCET_URL=https://faucet.example.com/api/drip
CUSTOM_FAUCET_METHOD=POST
CUSTOM_FAUCET_HEADERS={"Authorization":"Bearer TOKENKU"}
CUSTOM_FAUCET_BODY={"address":"{{address}}","network":"{{network}}","token":"{{token}}"}
```

Respons JSON yang mengandung `txHash` / `transactionHash` / `hash` (64 hex) akan dipakai sebagai tx hash; jika tidak ada, claim tetap dianggap sukses.

## Catatan

- Faucet punya rate limit (mis. CDP: 0.0001 ETH per request, maks 0.1 ETH per 24 jam per alamat). Cooldown default tool ini 12 jam per (network, faucet, address) — gunakan hanya untuk kebutuhan testing, sesuai ToS masing-masing faucet.
- Faucet yang mewajibkan login/CAPTCHA di browser (mis. Alchemy/Coinbase web faucet) sengaja tidak diotomasi; tool ini hanya memakai endpoint API resmi yang memerlukan API key milikmu sendiri.
- Riwayat claim tersimpan di `data/claims.json` (bisa di-override via `LEDGER_PATH`).

## Testing

Mock faucet + RPC loopback (tanpa jaringan eksternal):

```bash
node scripts/mock-faucet.mjs /tmp/mock.port &
PORT=$(cat /tmp/mock.port)
CUSTOM_FAUCET_URL=http://127.0.0.1:$PORT/faucet \
SEPOLIA_RPC_URL=http://127.0.0.1:$PORT/rpc \
BASE_SEPOLIA_RPC_URL=http://127.0.0.1:$PORT/rpc \
npm run dev -- claim --network all --address 0x1111111111111111111111111111111111111111 --faucet custom --wait
```

## Struktur

```
src/
├── index.ts          entry point
├── cli.ts            parsing argumen & command (claim/balance/history/networks)
├── claim.ts          orkestrasi claim + cooldown + ledger
├── networks.ts       definisi Sepolia & Base Sepolia (chainId, RPC, explorer)
├── rpc.ts            eth_getBalance / eth_getTransactionReceipt via JSON-RPC
├── ledger.ts         riwayat claim di data/claims.json
├── config.ts         loader .env & konfigurasi env
├── util.ts           retry fetch, format wei→ETH, logger
└── faucets/
    ├── cdp.ts        adapter CDP Faucet API (@coinbase/cdp-sdk)
    ├── http.ts       adapter custom HTTP faucet
    └── index.ts      registry faucet
```
