import { Contract, JsonRpcProvider, type AbstractSigner, parseUnits, formatUnits, type TransactionRequest, ethers } from "ethers";
import { ERC20_ABI, AGGREGATOR_V3_ABI } from "./abis.js";
import type { SkillConfig } from "./config.js";

export function providerFromConfig(cfg: SkillConfig) {
  return new JsonRpcProvider(cfg.rpcUrl);
}

export function txOverrides(cfg: SkillConfig): Partial<TransactionRequest> {
  const g = cfg.gas;
  if (!g?.maxFeePerGasGwei && !g?.maxPriorityFeePerGasGwei) return {};
  return {
    maxFeePerGas: g?.maxFeePerGasGwei ? parseUnits(String(g.maxFeePerGasGwei), "gwei") : undefined,
    maxPriorityFeePerGas: g?.maxPriorityFeePerGasGwei
      ? parseUnits(String(g.maxPriorityFeePerGasGwei), "gwei")
      : undefined
  };
}

export function erc20(address: string, signerOrProvider: any) {
  return new Contract(address, ERC20_ABI, signerOrProvider);
}

export async function erc20Meta(tokenAddr: string, prov: JsonRpcProvider) {
  const c = erc20(tokenAddr, prov);
  const [symbol, decimals, name] = await Promise.all([c.symbol(), c.decimals(), c.name()]);
  return { symbol: String(symbol), decimals: Number(decimals), name: String(name) };
}

export async function formatErc20(tokenAddr: string, amount: bigint, prov: JsonRpcProvider) {
  const meta = await erc20Meta(tokenAddr, prov);
  return `${formatUnits(amount, meta.decimals)} ${meta.symbol}`;
}

export function aggregator(feedAddr: string, signerOrProvider: any) {
  return new Contract(feedAddr, AGGREGATOR_V3_ABI, signerOrProvider);
}

export async function chainId(prov: JsonRpcProvider): Promise<number> {
  const net = await prov.getNetwork();
  return Number(net.chainId);
}

export async function requireAllowedChain(cfg: SkillConfig, prov: JsonRpcProvider) {
  const id = await chainId(prov);
  // Base Sepolia chainId = 84532
  const ok = cfg.safety.allowedChains.includes(cfg.chain);
  if (!ok) throw new Error(`Chain '${cfg.chain}' not in safety.allowedChains`);
  if (cfg.chain === "base-sepolia" && id !== 84532) {
    throw new Error(`Refusing to run: expected chainId 84532 (base-sepolia), got ${id}`);
  }
}

export async function ensureAllowance(
  tokenAddr: string,
  owner: AbstractSigner,
  spender: string,
  need: bigint,
  cfg: SkillConfig,
  dryRun: boolean
) {
  const ownerAddr = await owner.getAddress();
  const token = erc20(tokenAddr, owner);
  const current: bigint = await token.allowance(ownerAddr, spender);
  if (current >= need) return;

  if (dryRun) return;

  if (current > 0n) {
    const tx0 = await token.approve(spender, 0n, txOverrides(cfg));
    await tx0.wait(cfg.confirmations);
  }
  const tx = await token.approve(spender, ethers.MaxUint256, txOverrides(cfg));
  await tx.wait(cfg.confirmations);
}

export function parseAmount(amountStr: string, decimals: number): bigint {
  return parseUnits(amountStr, decimals);
}
