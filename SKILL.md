---
name: openclaw-usdc-skill
description: "Base Sepolia Power Wallet + USDC toolkit for OpenClaw agents (hackathon MVP)."
metadata: {"openclaw":{"emoji":"🪙","requires":{"bins":["node"]},"homepage":"https://github.com/power-wallet/openclaw-usdc-skill"}}
---

# openclaw-usdc-skill

Power Wallet + USDC + cbBTC utilities on **Base Sepolia** for OpenClaw agents.

This skill is implemented as a Node/TS CLI.

## Install

```bash
cd {baseDir}
npm install
npm run build
```

## Config

Copy and edit:

```bash
cp config.example.json config.json
```

Required env:
- `PW_RPC_URL` (Base Sepolia RPC URL)
- `PW_KEY_PASSWORD` (used to encrypt/decrypt the agent EOA keystore)

## Commands (CLI)

Run from the skill folder:

```bash
node dist/cli.js --help
```

Common flows:

```bash
# 1) Create agent EOA wallet
node dist/cli.js eoa:create --name agent

# 2) Check balances
node dist/cli.js balance --wallet agent

# 3) Read Chainlink prices
node dist/cli.js price --feed btc
node dist/cli.js price --feed eth

# 4) Create Power Wallet (Simple DCA default)
node dist/cli.js wallet:create --wallet agent

# 5) Deposit USDC into Power Wallet
node dist/cli.js wallet:deposit --wallet agent --powerwallet 0x... --amount-usdc 10

# 6) Swap USDC <-> cbBTC from personal wallet
node dist/cli.js swap --wallet agent --from usdc --to cbbtc --amount 10

# 7) Send USDC
node dist/cli.js usdc:send --wallet agent --to 0x... --amount-usdc 1
```

## Safety
- Testnet-only: expects Base Sepolia chain id.
- Never commit keys. Keys are stored under `{baseDir}/keys/` (gitignored).
