import { ethers } from "hardhat";
import {
    getArg,
    getDeployer,
    hashAddressAsKey,
    loadDeployments,
    parseArgs,
    requireDeployment,
    saveDeployments,
} from "./helpers";

async function main() {
    const args = parseArgs();
    const deployments = loadDeployments();
    const deployer = await getDeployer();

    const claimTopicsRegistryAddress = requireDeployment(
        deployments,
        "claimTopicsRegistry",
        "claimTopicsRegistry"
    );
    const trustedIssuersRegistryAddress = requireDeployment(
        deployments,
        "trustedIssuersRegistry",
        "trustedIssuersRegistry"
    );

    const claimTopicsRegistry = await ethers.getContractAt(
        "IClaimTopicsRegistry",
        claimTopicsRegistryAddress
    );
    const trustedIssuersRegistry = await ethers.getContractAt(
        "ITrustedIssuersRegistry",
        trustedIssuersRegistryAddress
    );

    const existingTopics = await claimTopicsRegistry.getClaimTopics();
    const defaultTopic = existingTopics.length > 0 ? existingTopics[0].toString() : "1";
    const topic = BigInt(getArg(args, "topic", defaultTopic)!);
    const providedIssuer = getArg(args, "issuer");

    let claimIssuerAddress = providedIssuer ?? deployments.claimIssuer;
    if (!claimIssuerAddress) {
        console.log("Deploying local ClaimIssuer...");
        const onchainId = require("@onchain-id/solidity");
        const claimIssuerFactory = new ethers.ContractFactory(
            onchainId.contracts.ClaimIssuer.abi,
            onchainId.contracts.ClaimIssuer.bytecode,
            deployer
        );
        const claimIssuer = await claimIssuerFactory.deploy(deployer.address);
        await claimIssuer.waitForDeployment();
        claimIssuerAddress = await claimIssuer.getAddress();
        saveDeployments({ claimIssuer: claimIssuerAddress });
        console.log(`   ClaimIssuer: ${claimIssuerAddress}`);
    }

    const claimIssuer = await ethers.getContractAt("IClaimIssuer", claimIssuerAddress);
    const deployerClaimKey = hashAddressAsKey(deployer.address);
    const hasClaimKey = await claimIssuer.keyHasPurpose(deployerClaimKey, 3);
    if (!hasClaimKey) {
        console.log("Adding deployer as claim signer on ClaimIssuer...");
        const tx = await claimIssuer.addKey(deployerClaimKey, 3, 1);
        await tx.wait();
    }

    const refreshedTopics = await claimTopicsRegistry.getClaimTopics();
    if (!refreshedTopics.some((value: bigint) => value === topic)) {
        console.log(`Adding claim topic ${topic.toString()} to ClaimTopicsRegistry...`);
        const tx = await claimTopicsRegistry.addClaimTopic(topic);
        await tx.wait();
    }

    const isTrusted = await trustedIssuersRegistry.isTrustedIssuer(claimIssuerAddress);
    if (!isTrusted) {
        console.log(`Adding ${claimIssuerAddress} as trusted issuer for topic ${topic.toString()}...`);
        const tx = await trustedIssuersRegistry.addTrustedIssuer(claimIssuerAddress, [topic]);
        await tx.wait();
    } else {
        const currentTopics = await trustedIssuersRegistry.getTrustedIssuerClaimTopics(claimIssuerAddress);
        if (!currentTopics.some((value: bigint) => value === topic)) {
            console.log(`Updating trusted issuer topics to include ${topic.toString()}...`);
            const tx = await trustedIssuersRegistry.updateIssuerClaimTopics(claimIssuerAddress, [
                ...currentTopics,
                topic,
            ]);
            await tx.wait();
        }
    }

    console.log(`Claim issuer ready: ${claimIssuerAddress}`);
    console.log(`Trusted topic: ${topic.toString()}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});