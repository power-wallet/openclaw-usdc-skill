import fs from "node:fs";
import path from "node:path";
import { z } from "zod";

const GasSchema = z
  .object({
    maxFeePerGasGwei: z.number().optional(),
    maxPriorityFeePerGasGwei: z.number().optional()
  })
  .optional();

export const ConfigSchema = z.object({
  chain: z.string().default("base-sepolia"),
  rpcUrl: z.string(),
  confirmations: z.number().int().positive().default(1),
  gas: GasSchema,
  slippageBps: z.number().int().min(0).max(5000).default(100),
  contracts: z.object({
    walletFactory: z.string(),
    strategyRegistry: z.string(),
    uniswapV3Router: z.string(),
    uniswapV3Factory: z.string()
  }),
  tokens: z.object({
    usdc: z.string(),
    weth: z.string(),
    cbBTC: z.string()
  }),
  chainlink: z.object({
    btcUsd: z.string(),
    ethUsd: z.string(),
    usdcUsd: z.string()
  }),
  defaults: z
    .object({
      riskAssets: z.array(z.string()).default(["cbBTC"]),
      poolFees: z.array(z.number().int()).default([500])
    })
    .default({ riskAssets: ["cbBTC"], poolFees: [500] }),
  safety: z
    .object({
      allowedChains: z.array(z.string()).default(["base-sepolia"]),
      requireConfirm: z.boolean().default(true),
      maxUsdcPerTx: z.string().default("50")
    })
    .default({ allowedChains: ["base-sepolia"], requireConfirm: true, maxUsdcPerTx: "50" })
});

export type SkillConfig = z.infer<typeof ConfigSchema>;

export function skillDir() {
  return path.resolve(process.cwd());
}

export function loadConfig(): SkillConfig {
  const cfgPath = path.resolve(skillDir(), "config.json");
  const examplePath = path.resolve(skillDir(), "config.example.json");

  const raw = fs.existsSync(cfgPath)
    ? JSON.parse(fs.readFileSync(cfgPath, "utf8"))
    : JSON.parse(fs.readFileSync(examplePath, "utf8"));

  // env overrides
  if (process.env.PW_RPC_URL) raw.rpcUrl = process.env.PW_RPC_URL;
  if (process.env.PW_CHAIN) raw.chain = process.env.PW_CHAIN;

  return ConfigSchema.parse(raw);
}
