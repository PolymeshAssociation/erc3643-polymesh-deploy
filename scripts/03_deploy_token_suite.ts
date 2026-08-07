/**
 * 03_deploy_token_suite.ts
 *
 * Calls TREXFactory.deployTREXSuite to create a complete
 * ERC-3643 token + registries + compliance in one transaction.
 */
import { ethers } from "hardhat";
import { getDeployer, loadDeployments, saveDeployments } from "./helpers";

async function main() {
  const deployer = await getDeployer();
  const d = loadDeployments();

  if (!d.trexFactory) {
    throw new Error("TREXFactory address missing. Run script 02 first.");
  }

  console.log("\n=== Deploying sample ERC-3643 token suite ===\n");

  const trexFactory = await ethers.getContractAt(
    "ITREXFactory", // or "TREXFactory"
    d.trexFactory
  );

  const salt = "PolymeshDemoToken-v1";

  // TokenDetails – adjust fields to match the exact struct in your T-REX version
  const tokenDetails = {
    owner: deployer.address,
    name: "Polymesh Demo Security Token",
    symbol: "PDST",
    decimals: 18,
    irs: ethers.ZeroAddress,          // let factory deploy a new IRS
    ONCHAINID: ethers.ZeroAddress,    // let factory create a token ONCHAINID
    irAgents: [deployer.address],
    tokenAgents: [deployer.address],
    complianceModules: [],            // add module addresses if you deployed any
    complianceSettings: [],
  };

  // ClaimDetails
  const claimDetails = {
    claimTopics: [1],                 // e.g. KYC = 1
    issuers: [],                      // add trusted issuer addresses later
    issuerClaims: [],
  };

  console.log("Calling deployTREXSuite with salt:", salt);
  console.log("Token name / symbol:", tokenDetails.name, "/", tokenDetails.symbol);

  try {
    // Some versions take (salt, tokenDetails, claimDetails)
    // Others take only (tokenDetails, claimDetails) when used via Gateway
    const tx = await trexFactory.deployTREXSuite(
      salt,
      tokenDetails,
      claimDetails,
      { gasLimit: 25_000_000 }
    );
    console.log("Tx hash:", tx.hash);
    const receipt = await tx.wait();
    console.log("Gas used:", receipt?.gasUsed?.toString());

    // Try to parse the TREXSuiteDeployed event
    // Event signature (approximate):
    // TREXSuiteDeployed(address token, address ir, address irs, address tir, address ctr, address mc, string salt)
    let tokenAddr: string | undefined;
    for (const log of receipt?.logs || []) {
      try {
        const parsed = trexFactory.interface.parseLog(log as any);
        if (parsed && parsed.name === "TREXSuiteDeployed") {
          tokenAddr = parsed.args[0];
          console.log("\nTREXSuiteDeployed event:");
          console.log("  token :", parsed.args[0]);
          console.log("  ir    :", parsed.args[1]);
          console.log("  irs   :", parsed.args[2]);
          console.log("  tir   :", parsed.args[3]);
          console.log("  ctr   :", parsed.args[4]);
          console.log("  mc    :", parsed.args[5]);
          saveDeployments({
            token: parsed.args[0],
            identityRegistry: parsed.args[1],
            identityRegistryStorage: parsed.args[2],
            trustedIssuersRegistry: parsed.args[3],
            claimTopicsRegistry: parsed.args[4],
            modularCompliance: parsed.args[5],
          });
          break;
        }
      } catch {
        // not the event we want
      }
    }

    if (!tokenAddr) {
      // Fallback: query the factory mapping
      try {
        const addr = await trexFactory.getToken(salt);
        console.log("Token address from getToken(salt):", addr);
        saveDeployments({ token: addr });
      } catch {
        console.log(
          "Could not extract token address automatically – check the transaction receipt."
        );
      }
    }
  } catch (err: any) {
    console.error("deployTREXSuite failed:", err.message);
    console.error(
      "Check that the TokenDetails / ClaimDetails structs match the ABI of your compiled TREXFactory."
    );
    throw err;
  }

  console.log("\nSample token suite deployment finished.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
