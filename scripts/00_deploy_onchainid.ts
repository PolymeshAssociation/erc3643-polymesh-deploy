/**
 * 00_deploy_onchainid.ts
 *
 * Deploys the ONCHAINID suite required by ERC-3643 / T-REX:
 *   1. Identity implementation (library = true)
 *   2. ImplementationAuthority
 *   3. IdFactory
 *
 * Target: local Polymesh chain via eth-rpc (Alith account)
 */
import { ethers } from "hardhat";
import { getDeployer, saveDeployments } from "./helpers";

async function main() {
  const deployer = await getDeployer();

  console.log("\n=== Deploying ONCHAINID suite ===\n");

  // ----------------------------------------------------------
  // 1. Identity implementation (as library)
  // ----------------------------------------------------------
  // We use the published @onchain-id/solidity package artifacts.
  // If you prefer to compile from source, place the contracts under ./contracts
  // and use ethers.getContractFactory("Identity") instead.

  const OnchainID = require("@onchain-id/solidity");

  console.log("1/3 Deploying Identity implementation (library)...");
  const identityImplFactory = new ethers.ContractFactory(
    OnchainID.contracts.Identity.abi,
    OnchainID.contracts.Identity.bytecode,
    deployer
  );
  // constructor(address initialManagementKey, bool isLibrary)
  const identityImpl = await identityImplFactory.deploy(
    deployer.address,
    true // isLibrary = true
  );
  await identityImpl.waitForDeployment();
  const identityImplAddr = await identityImpl.getAddress();
  console.log("   Identity implementation:", identityImplAddr);

  // ----------------------------------------------------------
  // 2. ImplementationAuthority
  // ----------------------------------------------------------
  console.log("2/3 Deploying ImplementationAuthority...");
  const iaFactory = new ethers.ContractFactory(
    OnchainID.contracts.ImplementationAuthority.abi,
    OnchainID.contracts.ImplementationAuthority.bytecode,
    deployer
  );
  const identityIA = await iaFactory.deploy(identityImplAddr);
  await identityIA.waitForDeployment();
  const identityIAAddr = await identityIA.getAddress();
  console.log("   ImplementationAuthority:", identityIAAddr);

  // ----------------------------------------------------------
  // 3. IdFactory
  // ----------------------------------------------------------
  console.log("3/3 Deploying IdFactory...");
  const idFactoryFactory = new ethers.ContractFactory(
    OnchainID.contracts.Factory.abi || OnchainID.contracts.IdFactory.abi,
    OnchainID.contracts.Factory.bytecode || OnchainID.contracts.IdFactory.bytecode,
    deployer
  );
  // Most versions: constructor(address implementationAuthority)
  const idFactory = await idFactoryFactory.deploy(identityIAAddr);
  await idFactory.waitForDeployment();
  const idFactoryAddr = await idFactory.getAddress();
  console.log("   IdFactory:", idFactoryAddr);

  // Persist
  saveDeployments({
    deployer: deployer.address,
    network: "polymeshLocal",
    identityImplementation: identityImplAddr,
    identityImplementationAuthority: identityIAAddr,
    idFactory: idFactoryAddr,
  });

  console.log("\nONCHAINID suite deployed successfully.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
