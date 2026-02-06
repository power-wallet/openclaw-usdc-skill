import "dotenv/config";
import { loadConfig } from "../src/config.js";
import { providerFromConfig, requireAllowedChain } from "../src/eth.js";
import { readChainlink } from "../src/prices.js";

// Very small smoke test: config loads + provider reachable + chainlink feeds read.
// Run: npm run test:dry

async function main() {
  const cfg = loadConfig();
  const prov = providerFromConfig(cfg);
  await requireAllowedChain(cfg, prov);

  const [btc, eth] = await Promise.all([
    readChainlink(cfg.chainlink.btcUsd, prov),
    readChainlink(cfg.chainlink.ethUsd, prov)
  ]);

  if (!btc.answer || !eth.answer) throw new Error("bad feed");
  console.log("BTC/USD:", btc.formatted);
  console.log("ETH/USD:", eth.formatted);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
