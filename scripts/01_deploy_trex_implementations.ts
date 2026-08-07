/**
 * 01_deploy_trex_implementations.ts
 *
 * Deploys the six core T-REX implementation contracts.
 * These will later be registered in TREXImplementationAuthority.
 *
 * NOTE: This script expects the official ERC-3643 / T-REX contracts
 * to be available either via:
 *   - npm package (if published), or
 *   - cloned into ./contracts (recommended for local work)
 *
 * For a minimal working setup we compile the interfaces + a few
 * placeholder contracts. In production you should use the exact
 * contracts from https://github.com/ERC-3643/ERC-3643
 */
import { ethers } from "hardhat";
import { getDeployer, saveDeployments, loadDeployments } from "./helpers";

async function main() {
  const deployer = await getDeployer();
  const existing = loadDeployments();

  if (!existing.idFactory) {
    console.warn(
      "⚠️  ONCHAINID IdFactory not found. Run 00_deploy_onchainid.ts first."
    );
  }

  console.log("\n=== Deploying T-REX implementation contracts ===\n");

  // Because the full T-REX source is large, this script demonstrates the
  // expected deployment order. You should replace the ContractFactory
  // calls with the real compiled artifacts from the ERC-3643 repo.
  //
  // Recommended workflow:
  //   1. git clone https://github.com/ERC-3643/ERC-3643.git trex-src
  //   2. copy the contracts/ folder into this project's contracts/
  //   3. npm run compile
  //   4. run this script again – ethers.getContractFactory will then work.

  const names = [
    "ClaimTopicsRegistry",
    "TrustedIssuersRegistry",
    "IdentityRegistryStorage",
    "IdentityRegistry",
    "ModularCompliance",
    "Token",
  ] as const;

  const addresses: Record<string, string> = {};

  for (const name of names) {
    console.log(`Deploying ${name} implementation...`);
    try {
      const factory = await ethers.getContractFactory(name);
      const impl = await factory.deploy();
      await impl.waitForDeployment();
      const addr = await impl.getAddress();
      addresses[name] = addr;
      console.log(`   ${name}:`, addr);
    } catch (err: any) {
      console.error(
        `   ❌ Could not deploy ${name}. Make sure the contract is present in ./contracts and compiled.`
      );
      console.error("      Error:", err.message?.slice(0, 200));
      // Continue so the user can see which contracts are missing
    }
  }

  saveDeployments({
    claimTopicsRegistryImpl: addresses["ClaimTopicsRegistry"],
    trustedIssuersRegistryImpl: addresses["TrustedIssuersRegistry"],
    identityRegistryStorageImpl: addresses["IdentityRegistryStorage"],
    identityRegistryImpl: addresses["IdentityRegistry"],
    modularComplianceImpl: addresses["ModularCompliance"],
    tokenImpl: addresses["Token"],
  });

  console.log("\nT-REX implementations step finished.");
  console.log(
    "If any contract failed, clone the official ERC-3643 repo into ./contracts and re-run."
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
