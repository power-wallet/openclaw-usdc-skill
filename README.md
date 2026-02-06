# PowerWallet USDC (Base Sepolia) — OpenClaw Skill MVP

Testnet-only CLI for interacting with **Power Wallet** contracts on **Base Sepolia**.

This skill is intentionally minimal and aims to support Carlo’s MVP flows:
- create an EOA (encrypted keystore stored locally)
- check ETH / ERC20 balances
- create a PowerWallet via `WalletFactory.createWallet()` wired to `SimpleDCA`
- deposit/withdraw USDC into/out of PowerWallet
- swap via Uniswap V3 `exactInputSingle` (from your EOA)
- send USDC
- query Chainlink feed prices

## Safety / scope
- **Base Sepolia only** by default.
- Keys are stored locally as **ethers keystore JSON** encrypted with a password.
- Use a throwaway testnet EOA.

## Install
```bash
cd /home/agent/clawd/skills/powerwallet-usdc
npm i
```

## Config
Copy the example and edit as needed:
```bash
cp config.example.json config.json
```
You can also override config values via env:
- `PW_RPC_URL`
- `PW_CHAIN=base-sepolia`

## Commands
Run via TS (no build):
```bash
npx tsx src/cli.ts --help
```

### 1) Create EOA (encrypted)
```bash
PW_KEY_PASSWORD='change-me' npx tsx src/cli.ts eoa:create --name demo
```
Outputs the new address and writes `keys/demo.json`.

### 2) Show balances (ETH + USDC + configured risk assets)
```bash
PW_KEY_PASSWORD='change-me' npx tsx src/cli.ts balance --wallet demo
```

### 3) Create PowerWallet with SimpleDCA
Creates a wallet that DCA-buys cbBTC using USDC.
```bash
PW_KEY_PASSWORD='change-me' npx tsx src/cli.ts wallet:create \
  --wallet demo \
  --strategy simple-btc-dca-v1 \
  --dca-usdc 1.0 \
  --frequency-seconds 3600
```

### 4) Deposit USDC into PowerWallet
```bash
PW_KEY_PASSWORD='change-me' npx tsx src/cli.ts wallet:deposit \
  --wallet demo \
  --powerwallet 0xYourPowerWallet \
  --amount-usdc 2.5
```

### 5) Withdraw USDC from PowerWallet (owner only)
```bash
PW_KEY_PASSWORD='change-me' npx tsx src/cli.ts wallet:withdraw \
  --wallet demo \
  --powerwallet 0xYourPowerWallet \
  --amount-usdc 1.0
```

### 6) Swap via Uniswap V3 router (from EOA)
Example: swap USDC -> WETH using pool fee 500.
```bash
PW_KEY_PASSWORD='change-me' npx tsx src/cli.ts swap \
  --wallet demo \
  --token-in usdc \
  --token-out weth \
  --amount-in 1.0 \
  --fee 500 \
  --slippage-bps 100
```

### 7) Send USDC
```bash
PW_KEY_PASSWORD='change-me' npx tsx src/cli.ts usdc:send \
  --wallet demo \
  --to 0xRecipient \
  --amount-usdc 0.5
```

### 8) Chainlink prices
```bash
npx tsx src/cli.ts price --feed btc
npx tsx src/cli.ts price --feed eth
```

## Dry-run testing
Most tx commands accept `--dry-run` which performs `estimateGas` and `callStatic` (when possible) without broadcasting.

```bash
PW_KEY_PASSWORD='change-me' npx tsx src/cli.ts wallet:create --wallet demo --dry-run
npm run test:dry
```

## Notes / next steps
- If you need on-chain swaps *inside* the PowerWallet, that happens via `performUpkeep()` + strategy decisions; there is no public `swap()` method on the wallet.
- For production: add hardware wallet support, stronger secrets storage, and chainId checks.
