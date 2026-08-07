/**
 * 02_deploy_trex_authority_and_factory.ts
 *
 * 1. Deploys TREXImplementationAuthority
 * 2. Registers a version that points at the implementations from step 01
 * 3. Deploys TREXFactory (linked to the ImplementationAuthority + IdFactory)
 * 4. Wires the factories together
 */
import { ethers } from "hardhat";
import { getDeployer, loadDeployments, saveDeployments } from "./helpers";

async function main() {
  const deployer = await getDeployer();
  const d = loadDeployments();

  if (
    !d.claimTopicsRegistryImpl ||
    !d.tokenImpl ||
    !d.idFactory
  ) {
    throw new Error(
      "Missing required addresses. Run scripts 00 and 01 first."
    );
  }

  console.log("\n=== Deploying TREXImplementationAuthority + TREXFactory ===\n");

  // ----------------------------------------------------------
  // 1. TREXImplementationAuthority
  // ----------------------------------------------------------
  console.log("1/4 Deploying TREXImplementationAuthority...");
  const trexIAFactory = await ethers.getContractFactory(
    "TREXImplementationAuthority"
  );
  // constructor(bool referenceStatus, address trexFactory, address iaFactory)
  const trexIA = await trexIAFactory.deploy(
    true, // referenceStatus
    ethers.ZeroAddress,
    ethers.ZeroAddress
  );
  await trexIA.waitForDeployment();
  const trexIAAddr = await trexIA.getAddress();
  console.log("   TREXImplementationAuthority:", trexIAAddr);

  // ----------------------------------------------------------
  // 2. Register version
  // ----------------------------------------------------------
  console.log("2/4 Registering TREX version...");
  // The exact function signature may vary slightly by T-REX version.
  // Common pattern:
  //   addAndUseTREXVersion(Version memory _version, TREXContracts memory _contracts)
  try {
    const version = { major: 4, minor: 1, patch: 6 }; // adjust to the version you compiled
    const contracts = {
      tokenImplementation: d.tokenImpl,
      ctrImplementation: d.claimTopicsRegistryImpl,
      irImplementation: d.identityRegistryImpl,
      irsImplementation: d.identityRegistryStorageImpl,
      tirImplementation: d.trustedIssuersRegistryImpl,
      mcImplementation: d.modularComplianceImpl,
    };
    const tx = await trexIA.addAndUseTREXVersion(version, contracts);
    await tx.wait();
    console.log("   Version registered.");
  } catch (err: any) {
    console.warn(
      "   Could not call addAndUseTREXVersion automatically:",
      err.message?.slice(0, 150)
    );
    console.warn(
      "   You may need to call it manually with the correct struct layout for your T-REX version."
    );
  }

  // ----------------------------------------------------------
  // 3. TREXFactory
  // ----------------------------------------------------------
  console.log("3/4 Deploying TREXFactory...");
  const trexFactoryFactory = await ethers.getContractFactory("TREXFactory");
  // constructor(address implementationAuthority, address idFactory)
  const trexFactory = await trexFactoryFactory.deploy(
    trexIAAddr,
    d.idFactory!
  );
  await trexFactory.waitForDeployment();
  const trexFactoryAddr = await trexFactory.getAddress();
  console.log("   TREXFactory:", trexFactoryAddr);

  // ----------------------------------------------------------
  // 4. Wire factories
  // ----------------------------------------------------------
  console.log("4/4 Wiring factories...");
  try {
    const tx1 = await trexIA.setTREXFactory(trexFactoryAddr);
    await tx1.wait();
    console.log("   setTREXFactory done.");
  } catch (e: any) {
    console.warn("   setTREXFactory failed (may already be set):", e.message?.slice(0, 100));
  }

  // Some IdFactory versions expose addTokenFactory
  try {
    const idFactory = await ethers.getContractAt(
      "IIdFactory", // or the concrete name used in your ONCHAINID version
      d.idFactory!
    );
    if (typeof (idFactory as any).addTokenFactory === "function") {
      const tx2 = await (idFactory as any).addTokenFactory(trexFactoryAddr);
      await tx2.wait();
      console.log("   IdFactory.addTokenFactory done.");
    }
  } catch {
    // optional – ignore if the method does not exist
  }

  saveDeployments({
    trexImplementationAuthority: trexIAAddr,
    trexFactory: trexFactoryAddr,
  });

  console.log("\nTREXAuthority + TREXFactory deployed successfully.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
