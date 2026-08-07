import { ethers } from "hardhat";
import {
    getArg,
    getDeployer,
    loadDeployments,
    parseArgs,
    requireDeployment,
} from "./helpers";

async function main() {
    const args = parseArgs();
    const deployments = loadDeployments();
    const claimTopicsRegistryAddress = requireDeployment(
        deployments,
        "claimTopicsRegistry",
        "claimTopicsRegistry"
    );

    await getDeployer();

    const claimTopicsRegistry = await ethers.getContractAt(
        "IClaimTopicsRegistry",
        claimTopicsRegistryAddress
    );
    const configuredTopic = getArg(args, "topic");
    const topics = configuredTopic
        ? [BigInt(configuredTopic)]
        : await claimTopicsRegistry.getClaimTopics();

    if (topics.length === 0) {
        console.log("No claim topics configured.");
        return;
    }

    for (const topic of topics) {
        console.log(`Removing claim topic ${topic.toString()}`);
        const tx = await claimTopicsRegistry.removeClaimTopic(topic);
        await tx.wait();
    }

    const remaining = await claimTopicsRegistry.getClaimTopics();
    console.log(`Remaining claim topics: ${remaining.map(String).join(", ") || "none"}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});