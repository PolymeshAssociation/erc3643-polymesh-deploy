import { ethers } from "hardhat";
import {
    deriveIdentitySalt,
    getArg,
    getDeployer,
    loadDeployments,
    parseArgs,
    requireArg,
    requireDeployment,
} from "./helpers";

async function main() {
    const args = parseArgs();
    const wallet = requireArg(args, "wallet");
    const country = Number(getArg(args, "country", "840"));
    const salt = getArg(args, "salt", deriveIdentitySalt(wallet));
    const deployments = loadDeployments();

    const idFactoryAddress = requireDeployment(deployments, "idFactory", "idFactory");
    const identityRegistryAddress = requireDeployment(
        deployments,
        "identityRegistry",
        "identityRegistry"
    );
    const claimTopicsRegistryAddress = requireDeployment(
        deployments,
        "claimTopicsRegistry",
        "claimTopicsRegistry"
    );

    await getDeployer();

    const idFactory = await ethers.getContractAt("IIdFactory", idFactoryAddress);
    const identityRegistry = await ethers.getContractAt(
        "IIdentityRegistry",
        identityRegistryAddress
    );
    const claimTopicsRegistry = await ethers.getContractAt(
        "IClaimTopicsRegistry",
        claimTopicsRegistryAddress
    );

    let identityAddress = await idFactory.getIdentity(wallet);
    if (identityAddress === ethers.ZeroAddress) {
        console.log(`Creating ONCHAINID for ${wallet} with salt ${salt}`);
        const tx = await idFactory.createIdentity(wallet, salt!);
        await tx.wait();
        identityAddress = await idFactory.getIdentity(wallet);
        console.log(`   ONCHAINID: ${identityAddress}`);
    } else {
        console.log(`Existing ONCHAINID found for ${wallet}: ${identityAddress}`);
    }

    const alreadyRegistered = await identityRegistry.contains(wallet);
    if (!alreadyRegistered) {
        console.log(`Registering ${wallet} in the token IdentityRegistry`);
        const tx = await identityRegistry.registerIdentity(wallet, identityAddress, country);
        await tx.wait();
    } else {
        console.log(`${wallet} is already registered in the IdentityRegistry`);
    }

    const claimTopics = await claimTopicsRegistry.getClaimTopics();
    const isVerified = await identityRegistry.isVerified(wallet);

    console.log(`Registered wallet: ${wallet}`);
    console.log(`Country: ${country}`);
    console.log(`Claim topics configured: ${claimTopics.map(String).join(", ") || "none"}`);
    console.log(`Verified: ${isVerified}`);

    if (!isVerified && claimTopics.length > 0) {
        console.log(
            "Warning: this local suite requires claims for the configured claim topics. For quick local funding, clear the claim topics or add trusted issuers and claims first."
        );
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});