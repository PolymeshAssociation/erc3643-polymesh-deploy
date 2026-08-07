import fs from "fs";
import hre, { ethers } from "hardhat";
import type { InterfaceAbi } from "ethers";
import {
    loadDeployments,
    requireDeployment,
} from "./helpers";

interface VerificationTarget {
    label: string;
    address: string;
    constructorArguments: unknown[];
    contract?: string;
    packageBuildInfo?: string;
    packageSourceName?: string;
    packageContractName?: string;
}

interface BuildInfoFile {
    solcLongVersion: string;
    input: Record<string, unknown>;
}

interface ExplorerResponse {
    status: string;
    message: string;
    result: string;
}

function getExplorerApiUrl() {
    const apiUrl = process.env.BLOCKSCOUT_API_URL || "http://127.0.0.1:4001/api";
    const url = new URL(apiUrl);
    url.searchParams.set("chainid", String(Number(process.env.CHAIN_ID) || 1641818));
    return url;
}

function getExplorerApiKey() {
    return process.env.BLOCKSCOUT_API_KEY || "blockscout";
}

function encodeConstructorArguments(abi: InterfaceAbi, constructorArguments: unknown[]) {
    const contractInterface = new ethers.Interface(abi);
    return contractInterface.encodeDeploy(constructorArguments).replace("0x", "");
}

async function postVerificationRequest(parameters: URLSearchParams) {
    const response = await fetch(getExplorerApiUrl(), {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: parameters.toString(),
    });

    if (!response.ok) {
        throw new Error(`Explorer request failed with status ${response.status}`);
    }

    return (await response.json()) as ExplorerResponse;
}

async function getVerificationStatus(guid: string) {
    const url = getExplorerApiUrl();
    url.searchParams.set("apikey", getExplorerApiKey());
    url.searchParams.set("module", "contract");
    url.searchParams.set("action", "checkverifystatus");
    url.searchParams.set("guid", guid);

    const response = await fetch(url, { method: "GET" });
    if (!response.ok) {
        throw new Error(`Explorer status request failed with status ${response.status}`);
    }

    return (await response.json()) as ExplorerResponse;
}

async function verifyWithPackageBuildInfo(target: VerificationTarget) {
    const buildInfoPath = target.packageBuildInfo;
    const sourceName = target.packageSourceName;
    const contractName = target.packageContractName;

    if (!buildInfoPath || !sourceName || !contractName) {
        throw new Error(`Missing package build info configuration for ${target.label}`);
    }

    const buildInfo = JSON.parse(fs.readFileSync(buildInfoPath, "utf8")) as BuildInfoFile;
    const artifact = require(`@onchain-id/solidity/artifacts/${sourceName.replace("contracts/", "contracts/")}/${contractName}.json`);
    const encodedConstructorArguments = encodeConstructorArguments(
        artifact.abi,
        target.constructorArguments
    );

    const parameters = new URLSearchParams({
        apikey: getExplorerApiKey(),
        module: "contract",
        action: "verifysourcecode",
        contractaddress: target.address,
        sourceCode: JSON.stringify(buildInfo.input),
        codeformat: "solidity-standard-json-input",
        contractname: `${sourceName}:${contractName}`,
        compilerversion: `v${buildInfo.solcLongVersion}`,
        constructorArguements: encodedConstructorArguments,
    });

    const submitResponse = await postVerificationRequest(parameters);
    if (/already verified/i.test(submitResponse.result)) {
        console.log(`   Skipping ${target.label}: already verified`);
        return;
    }
    if (submitResponse.status !== "1") {
        throw new Error(`${target.label} verification submission failed: ${submitResponse.result}`);
    }

    const guid = submitResponse.result;
    for (let attempt = 0; attempt < 15; attempt += 1) {
        const status = await getVerificationStatus(guid);
        if (status.result === "Pass - Verified") {
            console.log(`   Verified ${target.label}`);
            return;
        }
        if (status.result !== "Pending in queue") {
            throw new Error(`${target.label} verification failed: ${status.result}`);
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    throw new Error(`${target.label} verification did not complete before timeout`);
}

async function verifyTarget(target: VerificationTarget) {
    console.log(`\nVerifying ${target.label} at ${target.address}`);
    if (target.packageBuildInfo) {
        await verifyWithPackageBuildInfo(target);
        return;
    }

    try {
        await hre.run("verify:verify", {
            address: target.address,
            contract: target.contract,
            constructorArguments: target.constructorArguments,
        });
        console.log(`   Verified ${target.label}`);
    } catch (error: any) {
        const message = error?.message || String(error);
        if (
            /already verified/i.test(message) ||
            /already been verified/i.test(message) ||
            /Contract source code already verified/i.test(message)
        ) {
            console.log(`   Skipping ${target.label}: already verified`);
            return;
        }
        throw error;
    }
}

function buildTargets() {
    const deployments = loadDeployments();
    const identityImplementation = requireDeployment(
        deployments,
        "identityImplementation",
        "identityImplementation"
    );
    const identityImplementationAuthority = requireDeployment(
        deployments,
        "identityImplementationAuthority",
        "identityImplementationAuthority"
    );
    const idFactory = requireDeployment(deployments, "idFactory", "idFactory");
    const trexImplementationAuthority = requireDeployment(
        deployments,
        "trexImplementationAuthority",
        "trexImplementationAuthority"
    );
    const trexFactory = requireDeployment(
        deployments,
        "trexFactory",
        "trexFactory"
    );
    const tokenName = deployments.tokenName ?? "Polymesh Demo Security Token";
    const tokenSymbol = deployments.tokenSymbol ?? "PDST";
    const tokenDecimals = deployments.tokenDecimals ?? 18;
    const tokenOnchainIdAtDeployment =
        deployments.tokenOnchainIdAtDeployment ?? ethers.ZeroAddress;
    const deployer = requireDeployment(deployments, "deployer", "deployer");

    const targets: VerificationTarget[] = [
        {
            label: "ONCHAINID Identity implementation",
            address: identityImplementation,
            constructorArguments: [deployer, true],
            packageBuildInfo:
                "node_modules/@onchain-id/solidity/artifacts/build-info/9b9392991862eaccef6cd94ef23392e8.json",
            packageSourceName: "contracts/Identity.sol",
            packageContractName: "Identity",
        },
        {
            label: "ONCHAINID ImplementationAuthority",
            address: identityImplementationAuthority,
            constructorArguments: [identityImplementation],
            packageBuildInfo:
                "node_modules/@onchain-id/solidity/artifacts/build-info/9b9392991862eaccef6cd94ef23392e8.json",
            packageSourceName: "contracts/proxy/ImplementationAuthority.sol",
            packageContractName: "ImplementationAuthority",
        },
        {
            label: "ONCHAINID IdFactory",
            address: idFactory,
            constructorArguments: [identityImplementationAuthority],
            packageBuildInfo:
                "node_modules/@onchain-id/solidity/artifacts/build-info/9b9392991862eaccef6cd94ef23392e8.json",
            packageSourceName: "contracts/factory/IdFactory.sol",
            packageContractName: "IdFactory",
        },
        ...(deployments.claimIssuer
            ? [
                {
                    label: "ONCHAINID ClaimIssuer",
                    address: deployments.claimIssuer,
                    constructorArguments: [deployer],
                    packageBuildInfo:
                        "node_modules/@onchain-id/solidity/artifacts/build-info/9b9392991862eaccef6cd94ef23392e8.json",
                    packageSourceName: "contracts/ClaimIssuer.sol",
                    packageContractName: "ClaimIssuer",
                } satisfies VerificationTarget,
            ]
            : []),
        {
            label: "ClaimTopicsRegistry implementation",
            address: requireDeployment(
                deployments,
                "claimTopicsRegistryImpl",
                "claimTopicsRegistryImpl"
            ),
            contract:
                "contracts/registry/implementation/ClaimTopicsRegistry.sol:ClaimTopicsRegistry",
            constructorArguments: [],
        },
        {
            label: "TrustedIssuersRegistry implementation",
            address: requireDeployment(
                deployments,
                "trustedIssuersRegistryImpl",
                "trustedIssuersRegistryImpl"
            ),
            contract:
                "contracts/registry/implementation/TrustedIssuersRegistry.sol:TrustedIssuersRegistry",
            constructorArguments: [],
        },
        {
            label: "IdentityRegistryStorage implementation",
            address: requireDeployment(
                deployments,
                "identityRegistryStorageImpl",
                "identityRegistryStorageImpl"
            ),
            contract:
                "contracts/registry/implementation/IdentityRegistryStorage.sol:IdentityRegistryStorage",
            constructorArguments: [],
        },
        {
            label: "IdentityRegistry implementation",
            address: requireDeployment(
                deployments,
                "identityRegistryImpl",
                "identityRegistryImpl"
            ),
            contract:
                "contracts/registry/implementation/IdentityRegistry.sol:IdentityRegistry",
            constructorArguments: [],
        },
        {
            label: "ModularCompliance implementation",
            address: requireDeployment(
                deployments,
                "modularComplianceImpl",
                "modularComplianceImpl"
            ),
            contract:
                "contracts/compliance/modular/ModularCompliance.sol:ModularCompliance",
            constructorArguments: [],
        },
        {
            label: "Token implementation",
            address: requireDeployment(deployments, "tokenImpl", "tokenImpl"),
            contract: "contracts/token/Token.sol:Token",
            constructorArguments: [],
        },
        {
            label: "TREXImplementationAuthority",
            address: trexImplementationAuthority,
            contract:
                "contracts/proxy/authority/TREXImplementationAuthority.sol:TREXImplementationAuthority",
            constructorArguments: [true, ethers.ZeroAddress, ethers.ZeroAddress],
        },
        {
            label: "TREXFactory",
            address: trexFactory,
            contract: "contracts/factory/TREXFactory.sol:TREXFactory",
            constructorArguments: [trexImplementationAuthority, idFactory],
        },
        {
            label: "ClaimTopicsRegistry proxy",
            address: requireDeployment(
                deployments,
                "claimTopicsRegistry",
                "claimTopicsRegistry"
            ),
            contract: "contracts/proxy/ClaimTopicsRegistryProxy.sol:ClaimTopicsRegistryProxy",
            constructorArguments: [trexImplementationAuthority],
        },
        {
            label: "TrustedIssuersRegistry proxy",
            address: requireDeployment(
                deployments,
                "trustedIssuersRegistry",
                "trustedIssuersRegistry"
            ),
            contract:
                "contracts/proxy/TrustedIssuersRegistryProxy.sol:TrustedIssuersRegistryProxy",
            constructorArguments: [trexImplementationAuthority],
        },
        {
            label: "IdentityRegistryStorage proxy",
            address: requireDeployment(
                deployments,
                "identityRegistryStorage",
                "identityRegistryStorage"
            ),
            contract:
                "contracts/proxy/IdentityRegistryStorageProxy.sol:IdentityRegistryStorageProxy",
            constructorArguments: [trexImplementationAuthority],
        },
        {
            label: "IdentityRegistry proxy",
            address: requireDeployment(
                deployments,
                "identityRegistry",
                "identityRegistry"
            ),
            contract: "contracts/proxy/IdentityRegistryProxy.sol:IdentityRegistryProxy",
            constructorArguments: [
                trexImplementationAuthority,
                requireDeployment(
                    deployments,
                    "trustedIssuersRegistry",
                    "trustedIssuersRegistry"
                ),
                requireDeployment(
                    deployments,
                    "claimTopicsRegistry",
                    "claimTopicsRegistry"
                ),
                requireDeployment(
                    deployments,
                    "identityRegistryStorage",
                    "identityRegistryStorage"
                ),
            ],
        },
        {
            label: "ModularCompliance proxy",
            address: requireDeployment(
                deployments,
                "modularCompliance",
                "modularCompliance"
            ),
            contract: "contracts/proxy/ModularComplianceProxy.sol:ModularComplianceProxy",
            constructorArguments: [trexImplementationAuthority],
        },
        {
            label: "Token proxy",
            address: requireDeployment(deployments, "token", "token"),
            contract: "contracts/proxy/TokenProxy.sol:TokenProxy",
            constructorArguments: [
                trexImplementationAuthority,
                requireDeployment(deployments, "identityRegistry", "identityRegistry"),
                requireDeployment(deployments, "modularCompliance", "modularCompliance"),
                tokenName,
                tokenSymbol,
                tokenDecimals,
                tokenOnchainIdAtDeployment,
            ],
        },
    ];

    return targets;
}

async function main() {
    console.log(
        `Using BlockScout API ${process.env.BLOCKSCOUT_API_URL || "http://127.0.0.1:4001/api"}`
    );
    console.log(
        `Using BlockScout browser ${process.env.BLOCKSCOUT_BROWSER_URL || "http://127.0.0.1:4000"}`
    );

    const targets = buildTargets();
    for (const target of targets) {
        await verifyTarget(target);
    }

    console.log("\nBlockScout verification completed.");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});