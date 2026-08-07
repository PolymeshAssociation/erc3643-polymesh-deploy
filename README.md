# ERC-3643 + ONCHAINID Deployment on Local Polymesh (Revive / eth-rpc)

This Hardhat project deploys the full **ERC-3643 (T-REX)** suite together with the required **ONCHAINID** contracts onto a **local Polymesh development chain** that exposes an Ethereum JSON-RPC endpoint via the **Revive `eth-rpc` adapter**.

## Prerequisites

1. Local Polymesh node running in `--dev` mode with `pallet-revive` enabled.
2. Local `eth-rpc` process connected to the node (default: `http://127.0.0.1:8545`).
3. The standard development account **Alith** is pre-funded:
   - Address: `0xf24FF3a9CF04c71Dbc94D0b566f7A27B94566cac`
   - Private key: `0x5fb92d6e98884f76de468fa3f6278f39c8ac9602ab`

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# (Alith key is already set; adjust ETH_RPC_URL / CHAIN_ID if needed)

# 3. (Recommended) Bring in the official T-REX contracts
git clone --depth 1 https://github.com/ERC-3643/ERC-3643.git trex-src
cp -r trex-src/contracts/* contracts/
# Also copy any needed interfaces / libraries

# 4. Compile
npx hardhat compile

# 5. Deploy in order
npm run deploy:onchainid   # ONCHAINID Identity + ImplementationAuthority + IdFactory
npm run deploy:impls       # T-REX implementation contracts
npm run deploy:factory     # TREXImplementationAuthority + TREXFactory
npm run deploy:suite       # Full token suite via deployTREXSuite

# Or all at once
npm run deploy:all
```

Addresses are written to `deployments/polymesh-local.json` after each step.

## Project Structure

```
├── hardhat.config.ts          # polymeshLocal network (Alith + eth-rpc)
├── package.json
├── .env.example
├── scripts/
│   ├── helpers.ts             # load/save deployment addresses
│   ├── 00_deploy_onchainid.ts
│   ├── 01_deploy_trex_implementations.ts
│   ├── 02_deploy_trex_authority_and_factory.ts
│   └── 03_deploy_token_suite.ts
├── contracts/                 # place T-REX + ONCHAINID sources here
└── deployments/
    └── polymesh-local.json    # generated addresses
```

## Notes specific to Polymesh / Revive

- Use the **EVM path** (standard `solc` bytecode). The dual-VM engine executes it in REVM.
- Gas limits are set high (30 M) because factory deployments are large.
- CREATE2 works, so deterministic addresses from the factories are preserved.
- All transactions are signed by Alith through the eth-rpc endpoint – no Substrate extrinsic signing is required.
- After the factories exist you can call `deployTREXSuite` again with a different salt to create more tokens.

## Official Sources

- ERC-3643 / T-REX: https://github.com/ERC-3643/ERC-3643
- ONCHAINID: https://github.com/onchain-id/solidity (`@onchain-id/solidity` npm package)
- Polymesh Revive / EVM docs: see Polymesh v8 release notes and Polkadot pallet-revive documentation.
