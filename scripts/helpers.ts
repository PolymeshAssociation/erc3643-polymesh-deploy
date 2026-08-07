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

  // Token suite deployment metadata
  tokenSuiteSalt?: string;
  tokenName?: string;
  tokenSymbol?: string;
  tokenDecimals?: number;
  tokenIdentityOwner?: string;
  tokenOnchainIdAtDeployment?: string;

  // Local claim onboarding helpers
  claimIssuer?: string;

  // Meta
  deployer?: string;
  network?: string;
  timestamp?: string;
}

export interface ParsedArgs {
  _: string[];
  [key: string]: string | string[];
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

export function parseArgs(argv = process.argv.slice(2)): ParsedArgs {
  const parsed: ParsedArgs = { _: [] };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (!current.startsWith("--")) {
      parsed._.push(current);
      continue;
    }

    const withoutPrefix = current.slice(2);
    const eqIndex = withoutPrefix.indexOf("=");
    const key = eqIndex >= 0 ? withoutPrefix.slice(0, eqIndex) : withoutPrefix;
    const inlineValue = eqIndex >= 0 ? withoutPrefix.slice(eqIndex + 1) : undefined;
    const next = argv[index + 1];
    const value = inlineValue ?? (next && !next.startsWith("--") ? next : "true");

    if (inlineValue === undefined && next && !next.startsWith("--")) {
      index += 1;
    }

    const existing = parsed[key];
    if (existing === undefined) {
      parsed[key] = value;
      continue;
    }

    parsed[key] = Array.isArray(existing)
      ? [...existing, value]
      : [existing, value];
  }

  return parsed;
}

export function getArg(
  args: ParsedArgs,
  key: string,
  fallback?: string
): string | undefined {
  const value = args[key];
  if (Array.isArray(value)) {
    return value[value.length - 1];
  }
  return value ?? fallback;
}

export function requireArg(args: ParsedArgs, key: string): string {
  const value = getArg(args, key);
  if (!value || value === "true") {
    throw new Error(`Missing required argument --${key}`);
  }
  return value;
}

export function hasFlag(args: ParsedArgs, key: string): boolean {
  const value = getArg(args, key);
  return value === "true";
}

export function requireDeployment(
  deployments: DeploymentAddresses,
  key: keyof DeploymentAddresses,
  label?: string
): string {
  const value = deployments[key];
  if (!value || typeof value !== "string") {
    throw new Error(`Missing deployment address for ${label ?? String(key)}`);
  }
  return value;
}

export function deriveIdentitySalt(address: string, prefix = "investor"): string {
  return `${prefix}-${address.toLowerCase()}`;
}

export function hashAddressAsKey(address: string): string {
  return ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(["address"], [address]));
}
