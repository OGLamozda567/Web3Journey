import fs from "node:fs";
import http from "node:http";

const portFile = process.argv[2];
const FAKE_TX = "0x" + "11".repeat(32);
const state = { lastTx: null, faucetHits: 0 };

const server = http.createServer((req, res) => {
  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", () => {
    if (req.url === "/faucet" && req.method === "POST") {
      state.faucetHits += 1;
      let parsed = {};
      try {
        parsed = JSON.parse(body || "{}");
      } catch {
        parsed = {};
      }
      console.log(`[mock] faucet hit #${state.faucetHits}: ${body}`);
      if (!/^0x[a-fA-F0-9]{40}$/.test(parsed.address ?? "")) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "invalid address" }));
        return;
      }
      state.lastTx = FAKE_TX;
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ txHash: FAKE_TX }));
      return;
    }
    if (req.url === "/rpc" && req.method === "POST") {
      const msg = JSON.parse(body || "{}");
      console.log(`[mock] rpc: ${msg.method} ${JSON.stringify(msg.params)}`);
      let result = null;
      if (msg.method === "eth_getBalance") result = "0xde0b6b3a7640000";
      if (msg.method === "eth_getTransactionReceipt" && msg.params[0] === state.lastTx) {
        result = { transactionHash: state.lastTx, status: "0x1", blockNumber: "0x1234" };
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ jsonrpc: "2.0", id: msg.id, result }));
      return;
    }
    res.writeHead(404);
    res.end("not found");
  });
});

server.listen(0, "127.0.0.1", () => {
  const port = server.address().port;
  if (portFile) fs.writeFileSync(portFile, String(port));
  console.log(`[mock] listening on http://127.0.0.1:${port}`);
});
