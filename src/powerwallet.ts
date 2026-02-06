import { Contract, type JsonRpcProvider, type AbstractSigner, ethers, formatUnits } from "ethers";
import {
  POWERWALLET_ABI,
  STRATEGY_REGISTRY_ABI,
  UNISWAP_V3_ROUTER_ABI,
  WALLET_FACTORY_ABI,
  ifaceSimpleDca
} from "./abis.js";
import { ensureAllowance, erc20, erc20Meta, parseAmount, txOverrides } from "./eth.js";
import type { SkillConfig } from "./config.js";
import { readChainlink } from "./prices.js";

export function walletFactory(addr: string, signerOrProvider: any) {
  return new Contract(addr, WALLET_FACTORY_ABI, signerOrProvider);
}

export async function listUserPowerWallets(cfg: SkillConfig, prov: JsonRpcProvider, user: string) {
  const factory = walletFactory(cfg.contracts.walletFactory, prov);
  const wallets: string[] = await factory.getUserWallets(user);
  return { user, wallets };
}

export function strategyRegistry(addr: string, signerOrProvider: any) {
  return new Contract(addr, STRATEGY_REGISTRY_ABI, signerOrProvider);
}

export function powerWallet(addr: string, signerOrProvider: any) {
  return new Contract(addr, POWERWALLET_ABI, signerOrProvider);
}

export function uniswapRouter(addr: string, signerOrProvider: any) {
  return new Contract(addr, UNISWAP_V3_ROUTER_ABI, signerOrProvider);
}

export function resolveTokenSymbol(cfg: SkillConfig, sym: string): string {
  const k = sym.toLowerCase();
  if (k === "usdc") return cfg.tokens.usdc;
  if (k === "weth") return cfg.tokens.weth;
  if (k === "cbbtc" || k === "cbbtc") return cfg.tokens.cbBTC;
  // allow raw address
  if (k.startsWith("0x") && k.length === 42) return sym;
  throw new Error(`Unknown token '${sym}'. Use 'usdc|weth|cbBTC' or a 0x address`);
}

export async function showBalances(cfg: SkillConfig, prov: JsonRpcProvider, address: string) {
  const ethBal = await prov.getBalance(address);
  const usdc = erc20(cfg.tokens.usdc, prov);
  const weth = erc20(cfg.tokens.weth, prov);
  const cbbtc = erc20(cfg.tokens.cbBTC, prov);
  const [usdcDec, wethDec, cbbtcDec] = await Promise.all([usdc.decimals(), weth.decimals(), cbbtc.decimals()]);
  const [usdcBal, wethBal, cbbtcBal] = await Promise.all([
    usdc.balanceOf(address),
    weth.balanceOf(address),
    cbbtc.balanceOf(address)
  ]);
  return {
    address,
    eth: formatUnits(ethBal, 18),
    usdc: formatUnits(usdcBal, usdcDec),
    weth: formatUnits(wethBal, wethDec),
    cbBTC: formatUnits(cbbtcBal, cbbtcDec)
  };
}

export async function createPowerWalletWithSimpleDca(params: {
  cfg: SkillConfig;
  prov: JsonRpcProvider;
  signer: AbstractSigner;
  strategyKey: string; // e.g. simple-btc-dca-v1
  dcaUsdc: string;
  frequencySeconds: number;
  dryRun: boolean;
}) {
  const { cfg, signer, prov, strategyKey, dcaUsdc, frequencySeconds, dryRun } = params;

  const usdcAddr = cfg.tokens.usdc;
  const riskAddr = cfg.tokens.cbBTC;
  const feedAddr = cfg.chainlink.btcUsd;
  const poolFee = cfg.defaults.poolFees[0] ?? 500;

  const usdcMeta = await erc20Meta(usdcAddr, prov);
  const dcaAmount = parseAmount(dcaUsdc, usdcMeta.decimals);

  const strategyId = ethers.id(strategyKey);
  const initData = ifaceSimpleDca.encodeFunctionData("initialize", [
    riskAddr,
    usdcAddr,
    dcaAmount,
    BigInt(frequencySeconds),
    `MVP SimpleDCA ${strategyKey}`
  ]);

  const factory = walletFactory(cfg.contracts.walletFactory, signer);

  const txReq = await factory.createWallet.populateTransaction(
    strategyId,
    initData,
    usdcAddr,
    [riskAddr],
    [feedAddr],
    [poolFee]
  );

  if (dryRun) {
    const gas = await signer.estimateGas({ ...txReq, ...txOverrides(cfg) });
    return { dryRun: true as const, gas: gas.toString() };
  }

  const tx = await signer.sendTransaction({ ...txReq, ...txOverrides(cfg) });
  const rc = await tx.wait(cfg.confirmations);

  // parse WalletCreated
  const ev = rc?.logs
    .map((l) => {
      try {
        return factory.interface.parseLog(l);
      } catch {
        return null;
      }
    })
    .find((x) => x?.name === "WalletCreated");

  const walletAddr = ev?.args?.wallet as string | undefined;
  const strategyInstance = ev?.args?.strategyInstance as string | undefined;

  return {
    dryRun: false as const,
    txHash: tx.hash,
    powerWallet: walletAddr,
    strategyInstance
  };
}

export async function depositToPowerWallet(params: {
  cfg: SkillConfig;
  prov: JsonRpcProvider;
  signer: AbstractSigner;
  powerWalletAddr: string;
  amountUsdc: string;
  dryRun: boolean;
}) {
  const { cfg, signer, prov, powerWalletAddr, amountUsdc, dryRun } = params;
  const usdcAddr = cfg.tokens.usdc;
  const usdcMeta = await erc20Meta(usdcAddr, prov);
  const amount = parseAmount(amountUsdc, usdcMeta.decimals);

  // safety
  const max = parseAmount(cfg.safety.maxUsdcPerTx, usdcMeta.decimals);
  if (amount > max) throw new Error(`Refusing: amount > safety.maxUsdcPerTx (${cfg.safety.maxUsdcPerTx} USDC)`);

  await ensureAllowance(usdcAddr, signer, powerWalletAddr, amount, cfg, dryRun);

  const pw = powerWallet(powerWalletAddr, signer);
  const txReq = await pw.deposit.populateTransaction(amount);
  if (dryRun) {
    const gas = await signer.estimateGas({ ...txReq, ...txOverrides(cfg) });
    return { dryRun: true as const, gas: gas.toString() };
  }
  const tx = await signer.sendTransaction({ ...txReq, ...txOverrides(cfg) });
  await tx.wait(cfg.confirmations);
  return { dryRun: false as const, txHash: tx.hash };
}

export async function withdrawFromPowerWallet(params: {
  cfg: SkillConfig;
  prov: JsonRpcProvider;
  signer: AbstractSigner;
  powerWalletAddr: string;
  amountUsdc: string;
  dryRun: boolean;
}) {
  const { cfg, signer, prov, powerWalletAddr, amountUsdc, dryRun } = params;
  const usdcAddr = cfg.tokens.usdc;
  const usdcMeta = await erc20Meta(usdcAddr, prov);
  const amount = parseAmount(amountUsdc, usdcMeta.decimals);

  const pw = powerWallet(powerWalletAddr, signer);
  const txReq = await pw.withdraw.populateTransaction(amount);
  if (dryRun) {
    const gas = await signer.estimateGas({ ...txReq, ...txOverrides(cfg) });
    return { dryRun: true as const, gas: gas.toString() };
  }
  const tx = await signer.sendTransaction({ ...txReq, ...txOverrides(cfg) });
  await tx.wait(cfg.confirmations);
  return { dryRun: false as const, txHash: tx.hash };
}

export async function sendUsdc(params: {
  cfg: SkillConfig;
  prov: JsonRpcProvider;
  signer: AbstractSigner;
  to: string;
  amountUsdc: string;
  dryRun: boolean;
}) {
  const { cfg, signer, prov, to, amountUsdc, dryRun } = params;
  const usdcAddr = cfg.tokens.usdc;
  const usdcMeta = await erc20Meta(usdcAddr, prov);
  const amount = parseAmount(amountUsdc, usdcMeta.decimals);
  const max = parseAmount(cfg.safety.maxUsdcPerTx, usdcMeta.decimals);
  if (amount > max) throw new Error(`Refusing: amount > safety.maxUsdcPerTx (${cfg.safety.maxUsdcPerTx} USDC)`);

  const token = erc20(usdcAddr, signer);
  const txReq = await token.transfer.populateTransaction(to, amount);
  if (dryRun) {
    const gas = await signer.estimateGas({ ...txReq, ...txOverrides(cfg) });
    return { dryRun: true as const, gas: gas.toString() };
  }
  const tx = await signer.sendTransaction({ ...txReq, ...txOverrides(cfg) });
  await tx.wait(cfg.confirmations);
  return { dryRun: false as const, txHash: tx.hash };
}

function computeAmountOutMinFromFeeds(args: {
  amountIn: bigint;
  tokenIn: { decimals: number; price: bigint; priceDecimals: number }; // if stable, price=1
  tokenOut: { decimals: number; price: bigint; priceDecimals: number };
  slippageBps: number;
}): bigint {
  const { amountIn, tokenIn, tokenOut, slippageBps } = args;

  // We use USD pricing: tokenInUSD = amountIn * priceIn
  // estimatedOut = tokenInUSD / priceOut
  // adjust decimals.

  // Normalize amountIn to tokenIn base units already.
  // tokenInUSD has (tokenIn.decimals + tokenIn.priceDecimals) decimals.
  const tokenInUsd = amountIn * tokenIn.price;

  // estimatedOut raw units:
  // tokenInUsd / priceOut * 10^(tokenOut.decimals) / 10^(tokenIn.decimals)
  // but careful with decimals: tokenInUsd has tokenIn.decimals+priceDec
  // Divide by priceOut (priceDecimals), leaving tokenIn.decimals+priceInDec-priceOutDec.

  // Use bigint with scaling approach:
  const scale = 10n ** BigInt(tokenOut.decimals);
  const denomScale = 10n ** BigInt(tokenIn.decimals);

  // tokenInUsd * scale / (priceOut * denomScale)
  const estimatedOut = (tokenInUsd * scale) / (tokenOut.price * denomScale);
  return (estimatedOut * BigInt(10000 - slippageBps)) / 10000n;
}

export async function swapExactInputSingle(params: {
  cfg: SkillConfig;
  prov: JsonRpcProvider;
  signer: AbstractSigner;
  tokenIn: string; // symbol or address
  tokenOut: string; // symbol or address
  amountIn: string; // human
  fee: number;
  slippageBps?: number;
  recipient?: string;
  dryRun: boolean;
}) {
  const { cfg, signer, prov, amountIn, fee, dryRun } = params;
  const tokenInAddr = resolveTokenSymbol(cfg, params.tokenIn);
  const tokenOutAddr = resolveTokenSymbol(cfg, params.tokenOut);
  const recipient = params.recipient ?? (await signer.getAddress());

  const router = uniswapRouter(cfg.contracts.uniswapV3Router, signer);

  const [inMeta, outMeta] = await Promise.all([erc20Meta(tokenInAddr, prov), erc20Meta(tokenOutAddr, prov)]);
  const amtIn = parseAmount(amountIn, inMeta.decimals);

  // derive minOut using chainlink (if we have feeds configured)
  // For MVP: support USDC<->(cbBTC|WETH) using config feeds.
  const slippage = params.slippageBps ?? cfg.slippageBps;

  // feed prices
  const usdcAddr = cfg.tokens.usdc.toLowerCase();
  const inIsUsdc = tokenInAddr.toLowerCase() === usdcAddr;
  const outIsUsdc = tokenOutAddr.toLowerCase() === usdcAddr;

  let amountOutMin = 0n;
  if (inIsUsdc || outIsUsdc) {
    const usdcFeed = await readChainlink(cfg.chainlink.usdcUsd, prov);
    const usdcPrice = BigInt(Math.round(Number(usdcFeed.answer))); // keep bigint
    const usdcPriceDec = usdcFeed.decimals;

    const tokenPrice = async (addr: string) => {
      const a = addr.toLowerCase();
      if (a === cfg.tokens.cbBTC.toLowerCase()) {
        const f = await readChainlink(cfg.chainlink.btcUsd, prov);
        return { price: f.answer, priceDecimals: f.decimals };
      }
      if (a === cfg.tokens.weth.toLowerCase()) {
        const f = await readChainlink(cfg.chainlink.ethUsd, prov);
        return { price: f.answer, priceDecimals: f.decimals };
      }
      // unknown -> no minOut
      return null;
    };

    if (inIsUsdc) {
      const outP = await tokenPrice(tokenOutAddr);
      if (outP) {
        amountOutMin = computeAmountOutMinFromFeeds({
          amountIn: amtIn,
          tokenIn: { decimals: inMeta.decimals, price: usdcPrice, priceDecimals: usdcPriceDec },
          tokenOut: { decimals: outMeta.decimals, price: outP.price, priceDecimals: outP.priceDecimals },
          slippageBps: slippage
        });
      }
    } else if (outIsUsdc) {
      const inP = await tokenPrice(tokenInAddr);
      if (inP) {
        amountOutMin = computeAmountOutMinFromFeeds({
          amountIn: amtIn,
          tokenIn: { decimals: inMeta.decimals, price: inP.price, priceDecimals: inP.priceDecimals },
          tokenOut: { decimals: outMeta.decimals, price: usdcPrice, priceDecimals: usdcPriceDec },
          slippageBps: slippage
        });
      }
    }
  }

  await ensureAllowance(tokenInAddr, signer, cfg.contracts.uniswapV3Router, amtIn, cfg, dryRun);

  const paramsTuple = {
    tokenIn: tokenInAddr,
    tokenOut: tokenOutAddr,
    fee,
    recipient,
    amountIn: amtIn,
    amountOutMinimum: amountOutMin,
    sqrtPriceLimitX96: 0
  };

  const txReq = await router.exactInputSingle.populateTransaction(paramsTuple);
  if (dryRun) {
    const gas = await signer.estimateGas({ ...txReq, ...txOverrides(cfg) });
    return { dryRun: true as const, gas: gas.toString(), amountOutMin: amountOutMin.toString() };
  }

  const tx = await signer.sendTransaction({ ...txReq, ...txOverrides(cfg) });
  const rc = await tx.wait(cfg.confirmations);
  return { dryRun: false as const, txHash: tx.hash, blockNumber: rc?.blockNumber, amountOutMin: amountOutMin.toString() };
}
