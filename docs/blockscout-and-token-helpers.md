# BlockScout Verification and Token Funding Helpers

This project now includes helper scripts for two local workflows:

1. verifying the deployed ERC-3643 and ONCHAINID contracts against a local BlockScout instance
2. preparing investors, minting tokens, and moving tokens between funded test accounts

All scripts read addresses from `deployments/polymesh-local.json`.

## BlockScout Verification

Local BlockScout defaults used by the Hardhat config:

```bash
BLOCKSCOUT_BROWSER_URL=http://127.0.0.1:4000
BLOCKSCOUT_API_URL=http://127.0.0.1:4001/api
BLOCKSCOUT_API_KEY=blockscout
```

Run verification after the deployment steps have completed:

```bash
npm run verify:blockscout
```

The verification helper covers:

- ONCHAINID `Identity`, `ImplementationAuthority`, and `IdFactory`
- T-REX implementation contracts
- `TREXImplementationAuthority` and `TREXFactory`
- the deployed suite proxies for token, registries, and compliance

If you redeployed the token suite with different token metadata, make sure `deployments/polymesh-local.json` contains the final `tokenName`, `tokenSymbol`, `tokenDecimals`, and `tokenOnchainIdAtDeployment` values.

## Token Funding Helpers

The local sample suite currently deploys with claim topic `1` and no trusted issuers. In T-REX that means a wallet is not considered verified until you either:

1. add trusted issuers and valid claims for that topic, or
2. clear the claim topics for local testing

There are now two supported local paths:

1. quick local testing: clear the claim topics
2. stricter local testing: onboard wallets with a trusted claim issuer and attach a valid claim to each investor identity

For quick local funding, the simplest path is to clear the claim topics once:

```bash
npm run token:clear-claim-topics
```

If you want to keep the claim requirement in place, first prepare a local trusted issuer:

```bash
npm run token:setup-claim-issuer
```

That helper will:

- deploy a local `ClaimIssuer` if one is not already recorded
- add the deployer as a claim-signing key on that issuer
- ensure the required claim topic exists in the claim topics registry
- add the issuer to the trusted issuers registry for that topic

Then onboard each wallet with a claim-backed ONCHAINID:

```bash
npm run token:onboard-investor -- --wallet 0xYourTestWallet --country 840
```

That helper will:

- create an ONCHAINID for the wallet if it does not exist yet
- create it with a deployer-managed management key so the helper can attach claims
- register the identity in the token Identity Registry
- sign and attach a claim for the configured claim topic
- confirm that the wallet is now `isVerified == true`

Important constraint: if a wallet already has an ONCHAINID that is not managed by the deployer, this helper cannot add claims to it. In that case you must either:

1. use the investor's management key wallet to manage its identity directly, or
2. clear claim topics for local testing instead

You can then prepare each recipient wallet with an ONCHAINID and Identity Registry entry:

```bash
npm run token:prepare-investor -- --wallet 0xYourTestWallet --country 840
```

Use `token:prepare-investor` only for the no-claims shortcut path. If claim topics remain enabled, prefer `token:onboard-investor`.

After that, mint directly to the recipient:

```bash
npm run token:mint -- --to 0xYourTestWallet --amount 1000
```

Or let the mint command create and register the investor record first:

```bash
npm run token:mint -- --to 0xYourTestWallet --amount 1000 --register-if-needed
```

To move balance between accounts, the helper uses `forcedTransfer` from the deployer agent account. That is the practical choice for funding local test wallets without switching signers:

```bash
npm run token:transfer -- --from 0xFundedWallet --to 0xAnotherWallet --amount 250
```

If transfers fail because the token is paused, use:

```bash
npm run token:unpause
```

And to pause it again later:

```bash
npm run token:pause
```

Both commands default to the deployed `token` address from `deployments/polymesh-local.json`. You can override with `--token 0x...` if needed.

You can also auto-register the recipient during transfer:

```bash
npm run token:transfer -- --from 0xFundedWallet --to 0xAnotherWallet --amount 250 --register-if-needed
```

## Script Summary

```bash
npm run verify:blockscout
npm run token:setup-claim-issuer [-- --topic 1] [--issuer 0x...]
npm run token:onboard-investor -- --wallet 0x... [--country 840] [--topic 1] [--salt investor-...] 
npm run token:prepare-investor -- --wallet 0x... [--country 840] [--salt investor-...]
npm run token:clear-claim-topics [-- --topic 1]
npm run token:mint -- --to 0x... --amount 1000 [--register-if-needed] [--country 840]
npm run token:transfer -- --from 0x... --to 0x... --amount 250 [--register-if-needed] [--country 840]
npm run token:pause
npm run token:unpause
```

## Notes

- Amounts are passed in whole token units and converted using the token's on-chain decimals.
- `token:transfer` uses the token agent's `forcedTransfer` function, not a user-signed ERC-20 `transfer`.
- `token:pause` / `token:unpause` require the caller to be a token agent.
- If you prefer the strict ERC-3643 path, keep the claim topics in place and use `token:setup-claim-issuer` plus `token:onboard-investor` instead of clearing them.