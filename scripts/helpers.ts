import * as fs from "fs";
import * as path from "path";
import { ethers } from "hardhat";

const DEPLOYMENTS_DIR = path.join(__dirname, "..", "deployments");
const DEPLOYMENTS_FILE = path.join(DEPLOYMENTS_DIR, "polymesh-local.json");

export interface DeploymentAddresses {
  // ONCHAINID
  identityImplementation?: string;
  identityImplementationAuthority?: string;
  idFactory?: string;

  // T-REX implementations
  claimTopicsRegistryImpl?: string;
  trustedIssuersRegistryImpl?: string;
  identityRegistryStorageImpl?: string;
  identityRegistryImpl?: string;
  modularComplianceImpl?: string;
  tokenImpl?: string;

  // Authority + Factory
  trexImplementationAuthority?: string;
  trexFactory?: string;

  // Sample token suite (from deployTREXSuite)
  token?: string;
  identityRegistry?: string;
  identityRegistryStorage?: string;
  claimTopicsRegistry?: string;
  trustedIssuersRegistry?: string;
  modularCompliance?: string;
  tokenONCHAINID?: string;

  // Meta
  deployer?: string;
  network?: string;
  timestamp?: string;
}

export function loadDeployments(): DeploymentAddresses {
  if (!fs.existsSync(DEPLOYMENTS_FILE)) {
    return {};
  }
  return JSON.parse(fs.readFileSync(DEPLOYMENTS_FILE, "utf8"));
}

export function saveDeployments(partial: Partial<DeploymentAddresses>) {
  if (!fs.existsSync(DEPLOYMENTS_DIR)) {
    fs.mkdirSync(DEPLOYMENTS_DIR, { recursive: true });
  }
  const current = loadDeployments();
  const updated: DeploymentAddresses = {
    ...current,
    ...partial,
    timestamp: new Date().toISOString(),
  };
  fs.writeFileSync(DEPLOYMENTS_FILE, JSON.stringify(updated, null, 2));
  console.log(`\n✅ Addresses saved to ${DEPLOYMENTS_FILE}`);
  return updated;
}

export async function getDeployer() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer (Alith):", deployer.address);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance));
  return deployer;
}
