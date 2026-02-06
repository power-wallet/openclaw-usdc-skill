#!/usr/bin/env node
import "dotenv/config";
import { Command } from "commander";
import { loadConfig } from "./config.js";
import { createEncryptedWallet, loadEncryptedWallet } from "./keys.js";
import { providerFromConfig, requireAllowedChain } from "./eth.js";
import {
  createPowerWalletWithSimpleDca,
  depositToPowerWallet,
  sendUsdc,
  showBalances,
  swapExactInputSingle,
  withdrawFromPowerWallet,
  listUserPowerWallets,
  showPowerWalletBalances,
  getPowerWalletConfig,
  setPureDcaConfig
} from "./powerwallet.js";
import { readChainlink } from "./prices.js";

const program = new Command();
program
  .name("powerwallet-usdc")
  .description("PowerWallet skill MVP (Base Sepolia)")
  .option("--config <path>", "(unused) config is loaded from ./config.json or ./config.example.json")
  .showHelpAfterError();

function mustPassword(): string {
  const p = process.env.PW_KEY_PASSWORD;
  if (!p) throw new Error("Missing PW_KEY_PASSWORD env var (used to encrypt/decrypt the local keystore)");
  return p;
}

program
  .command("eoa:create")
  .requiredOption("--name <name>", "keystore name (keys/<name>.json)")
  .action(async (opts) => {
    const res = await createEncryptedWallet(String(opts.name), mustPassword());
    console.log(jsonOut(res));
  });

program
  .command("balance")
  .option("--wallet <name>", "use local encrypted keystore")
  .option("--address <addr>", "address to query (if no --wallet)")
  .action(async (opts) => {
    const cfg = loadConfig();
    const prov = providerFromConfig(cfg);
    await requireAllowedChain(cfg, prov);

    let address: string;
    if (opts.wallet) {
      const w = await loadEncryptedWallet(String(opts.wallet), mustPassword());
      address = w.address;
    } else if (opts.address) {
      address = String(opts.address);
    } else {
      throw new Error("Provide --wallet or --address");
    }
    const out = await showBalances(cfg, prov, address);
    console.log(jsonOut(out));
  });

program
  .command("wallet:create")
  .requiredOption("--wallet <name>", "local encrypted keystore")
  .option("--strategy <key>", "strategy key (used with ethers.id)", "simple-btc-dca-v1")
  .option("--dca-usdc <amount>", "DCA amount in USDC (human)", "1.0")
  .option("--frequency-seconds <n>", "frequency seconds", "3600")
  .option("--dry-run", "estimate gas only", false)
  .action(async (opts) => {
    const cfg = loadConfig();
    const prov = providerFromConfig(cfg);
    await requireAllowedChain(cfg, prov);

    const signer = (await loadEncryptedWallet(String(opts.wallet), mustPassword())).connect(prov);
    const res = await createPowerWalletWithSimpleDca({
      cfg,
      prov,
      signer,
      strategyKey: String(opts.strategy),
      dcaUsdc: String(opts.dcaUsdc),
      frequencySeconds: Number(opts.frequencySeconds),
      dryRun: Boolean(opts.dryRun)
    });
    console.log(jsonOut(res));
  });

program
  .command("wallet:deposit")
  .requiredOption("--wallet <name>")
  .requiredOption("--powerwallet <addr>")
  .requiredOption("--amount-usdc <amt>")
  .option("--dry-run", "estimate gas only", false)
  .action(async (opts) => {
    const cfg = loadConfig();
    const prov = providerFromConfig(cfg);
    await requireAllowedChain(cfg, prov);

    const signer = (await loadEncryptedWallet(String(opts.wallet), mustPassword())).connect(prov);
    const res = await depositToPowerWallet({
      cfg,
      prov,
      signer,
      powerWalletAddr: String(opts.powerwallet),
      amountUsdc: String(opts.amountUsdc),
      dryRun: Boolean(opts.dryRun)
    });
    console.log(jsonOut(res));
  });

program
  .command("wallet:withdraw")
  .requiredOption("--wallet <name>")
  .requiredOption("--powerwallet <addr>")
  .requiredOption("--amount-usdc <amt>")
  .option("--dry-run", "estimate gas only", false)
  .action(async (opts) => {
    const cfg = loadConfig();
    const prov = providerFromConfig(cfg);
    await requireAllowedChain(cfg, prov);

    const signer = (await loadEncryptedWallet(String(opts.wallet), mustPassword())).connect(prov);
    const res = await withdrawFromPowerWallet({
      cfg,
      prov,
      signer,
      powerWalletAddr: String(opts.powerwallet),
      amountUsdc: String(opts.amountUsdc),
      dryRun: Boolean(opts.dryRun)
    });
    console.log(jsonOut(res));
  });

program
  .command("usdc:send")
  .requiredOption("--wallet <name>")
  .requiredOption("--to <addr>")
  .requiredOption("--amount-usdc <amt>")
  .option("--dry-run", "estimate gas only", false)
  .action(async (opts) => {
    const cfg = loadConfig();
    const prov = providerFromConfig(cfg);
    await requireAllowedChain(cfg, prov);

    const signer = (await loadEncryptedWallet(String(opts.wallet), mustPassword())).connect(prov);
    const res = await sendUsdc({
      cfg,
      prov,
      signer,
      to: String(opts.to),
      amountUsdc: String(opts.amountUsdc),
      dryRun: Boolean(opts.dryRun)
    });
    console.log(jsonOut(res));
  });

program
  .command("swap")
  .requiredOption("--wallet <name>")
  .requiredOption("--token-in <symOrAddr>")
  .requiredOption("--token-out <symOrAddr>")
  .requiredOption("--amount-in <amt>")
  .requiredOption("--fee <fee>")
  .option("--slippage-bps <n>")
  .option("--recipient <addr>")
  .option("--dry-run", "estimate gas only", false)
  .action(async (opts) => {
    const cfg = loadConfig();
    const prov = providerFromConfig(cfg);
    await requireAllowedChain(cfg, prov);

    const signer = (await loadEncryptedWallet(String(opts.wallet), mustPassword())).connect(prov);
    const res = await swapExactInputSingle({
      cfg,
      prov,
      signer,
      tokenIn: String(opts.tokenIn),
      tokenOut: String(opts.tokenOut),
      amountIn: String(opts.amountIn),
      fee: Number(opts.fee),
      slippageBps: opts.slippageBps ? Number(opts.slippageBps) : undefined,
      recipient: opts.recipient ? String(opts.recipient) : undefined,
      dryRun: Boolean(opts.dryRun)
    });
    console.log(jsonOut(res));
  });

program
  .command("wallets:list")
  .option("--wallet <name>", "use local encrypted keystore")
  .option("--address <addr>", "address to query (if no --wallet)")
  .action(async (opts) => {
    const cfg = loadConfig();
    const prov = providerFromConfig(cfg);
    await requireAllowedChain(cfg, prov);

    let address: string;
    if (opts.wallet) {
      const w = await loadEncryptedWallet(String(opts.wallet), mustPassword());
      address = w.address;
    } else if (opts.address) {
      address = String(opts.address);
    } else {
      throw new Error("Provide --wallet or --address");
    }

    const out = await listUserPowerWallets(cfg, prov, address);
    console.log(jsonOut(out));
  });

program
  .command("powerwallet:balance")
  .requiredOption("--powerwallet <addr>")
  .action(async (opts) => {
    const cfg = loadConfig();
    const prov = providerFromConfig(cfg);
    await requireAllowedChain(cfg, prov);

    const out = await showPowerWalletBalances(cfg, prov, String(opts.powerwallet));
    console.log(jsonOut(out));
  });

program
  .command("powerwallet:config")
  .requiredOption("--powerwallet <addr>")
  .action(async (opts) => {
    const cfg = loadConfig();
    const prov = providerFromConfig(cfg);
    await requireAllowedChain(cfg, prov);

    const out = await getPowerWalletConfig(cfg, prov, String(opts.powerwallet));
    console.log(jsonOut(out));
  });

program
  .command("pure:set")
  .requiredOption("--wallet <name>")
  .requiredOption("--strategy <addr>")
  .option("--dca-usdc <amount>")
  .option("--frequency-seconds <n>")
  .option("--dry-run", "estimate gas only", false)
  .action(async (opts) => {
    const cfg = loadConfig();
    const prov = providerFromConfig(cfg);
    await requireAllowedChain(cfg, prov);

    const signer = (await loadEncryptedWallet(String(opts.wallet), mustPassword())).connect(prov);
    const out = await setPureDcaConfig({
      cfg,
      prov,
      signer,
      strategyAddr: String(opts.strategy),
      amountUsdc: opts.dcaUsdc !== undefined ? String(opts.dcaUsdc) : undefined,
      frequencySeconds: opts.frequencySeconds !== undefined ? Number(opts.frequencySeconds) : undefined,
      dryRun: Boolean(opts.dryRun)
    });
    console.log(jsonOut(out));
  });

program
  .command("price")
  .requiredOption("--feed <btc|eth|usdc>")
  .action(async (opts) => {
    const cfg = loadConfig();
    const prov = providerFromConfig(cfg);
    await requireAllowedChain(cfg, prov);

    const f = String(opts.feed).toLowerCase();
    const addr = f === "btc" ? cfg.chainlink.btcUsd : f === "eth" ? cfg.chainlink.ethUsd : cfg.chainlink.usdcUsd;
    const out = await readChainlink(addr, prov);
    console.log(jsonOut(out));
  });

function jsonOut(obj: any) {
  // JSON.stringify can't serialize BigInt; convert to string.
  return JSON.stringify(
    obj,
    (_k, v) => (typeof v === "bigint" ? v.toString() : v),
    2
  );
}

program.parseAsync(process.argv).catch((e) => {
  console.error(e?.message ?? e);
  process.exit(1);
});
