import { Interface } from "ethers";

// Minimal ABIs for required interactions

export const ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function transferFrom(address from, address to, uint256 amount) returns (bool)"
];

export const WALLET_FACTORY_ABI = [
  "event WalletCreated(address indexed user, address wallet, bytes32 indexed strategyId, address strategyImpl, address strategyInstance)",
  "function createWallet(bytes32 strategyId, bytes strategyInitData, address stableAsset, address[] riskAssets, address[] priceFeeds, uint24[] poolFees) returns (address)",
  "function getUserWallets(address user) view returns (address[])",
  "function registry() view returns (address)",
  "function swapRouter() view returns (address)",
  "function uniswapV3Factory() view returns (address)"
];

export const STRATEGY_REGISTRY_ABI = [
  "function strategies(bytes32) view returns (address)",
  "function getStrategy(bytes32) view returns (address)",
  "function listStrategies() view returns (bytes32[])"
];

export const POWERWALLET_ABI = [
  "function owner() view returns (address)",
  "function stableAsset() view returns (address)",
  "function getRiskAssets() view returns (address[])",
  "function deposit(uint256 amount)",
  "function withdraw(uint256 amount)",
  "function withdrawAsset(address asset, uint256 amount)",
  "function getBalances() view returns (uint256 stableBal, uint256[] riskBals)",
  "function getPortfolioValueUSD() view returns (uint256 usd6)",
  "function slippageBps() view returns (uint16)",
  "function setSlippageBps(uint16)",
  "function closeWallet()"
];

export const SIMPLE_DCA_ABI = [
  "function initialize(address risk, address stable, uint256 amountStable, uint256 frequency, string desc)",
  "function setAuthorizedWallet(address)",
  "function transferOwnership(address)",
  "function riskAsset() view returns (address)",
  "function stableAsset() view returns (address)",
  "function dcaAmountStable() view returns (uint256)",
  "function frequency() view returns (uint256)",
  "function lastTimestamp() view returns (uint256)",
  "function description() view returns (string)",
  "function id() view returns (string)",
  "function name() view returns (string)"
];

export const UNISWAP_V3_ROUTER_ABI = [
  "function exactInputSingle((address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 amountIn,uint256 amountOutMinimum,uint160 sqrtPriceLimitX96) params) payable returns (uint256 amountOut)"
];

export const AGGREGATOR_V3_ABI = [
  "function decimals() view returns (uint8)",
  "function description() view returns (string)",
  "function latestRoundData() view returns (uint80 roundId,int256 answer,uint256 startedAt,uint256 updatedAt,uint80 answeredInRound)"
];

export const ifaceSimpleDca = new Interface(SIMPLE_DCA_ABI);
