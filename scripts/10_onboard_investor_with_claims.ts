import { ethers } from "hardhat";
import {
    deriveIdentitySalt,
    getArg,
    getDeployer,
    hashAddressAsKey,
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
    const uri = getArg(args, "uri", "local://kyc-demo");
    const scheme = Number(getArg(args, "scheme", "1"));
    const deployments = loadDeployments();
    const deployer = await getDeployer();

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
    const trustedIssuersRegistryAddress = requireDeployment(
        deployments,
        "trustedIssuersRegistry",
        "trustedIssuersRegistry"
    );
    const claimIssuerAddress = requireDeployment(deployments, "claimIssuer", "claimIssuer");

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

    const trustedIssuers = await trustedIssuersRegistry.getTrustedIssuersForClaimTopic(topic);
    if (!trustedIssuers.some((issuer: string) => issuer.toLowerCase() === claimIssuerAddress.toLowerCase())) {
        throw new Error(
            `Claim issuer ${claimIssuerAddress} is not trusted for topic ${topic.toString()}. Run token:setup-claim-issuer first.`
        );
    }

    const idFactory = await ethers.getContractAt("IIdFactory", idFactoryAddress);
    const identityRegistry = await ethers.getContractAt(
        "IIdentityRegistry",
        identityRegistryAddress
    );

    let identityAddress = await idFactory.getIdentity(wallet);
    if (identityAddress === ethers.ZeroAddress) {
        console.log(`Creating investor ONCHAINID for ${wallet} with deployer-managed keys...`);
        const tx = await idFactory.createIdentityWithManagementKeys(wallet, salt!, [
            hashAddressAsKey(deployer.address),
        ]);
        await tx.wait();
        identityAddress = await idFactory.getIdentity(wallet);
    } else {
        console.log(`Existing ONCHAINID found: ${identityAddress}`);
    }

    const identity = await ethers.getContractAt("IIdentity", identityAddress);
    const deployerHasManagementKey = await identity.keyHasPurpose(
        hashAddressAsKey(deployer.address),
        1
    );
    if (!deployerHasManagementKey) {
        throw new Error(
            `Deployer is not a management key on ${identityAddress}. This helper can only attach claims to identities it manages.`
        );
    }

    if (!(await identityRegistry.contains(wallet))) {
        console.log(`Registering ${wallet} in the token IdentityRegistry...`);
        const tx = await identityRegistry.registerIdentity(wallet, identityAddress, country);
        await tx.wait();
    }

    const claimData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "uint16"],
        [wallet, country]
    );
    const claimHash = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
            ["address", "uint256", "bytes"],
            [identityAddress, topic, claimData]
        )
    );
    const signature = await deployer.signMessage(ethers.getBytes(claimHash));

    const encodedAddClaim = identity.interface.encodeFunctionData("addClaim", [
        topic,
        scheme,
        claimIssuerAddress,
        signature,
        claimData,
        uri,
    ]);

    console.log(`Adding claim topic ${topic.toString()} to ${identityAddress}...`);
    const tx = await identity.execute(identityAddress, 0, encodedAddClaim);
    await tx.wait();

    const isVerified = await identityRegistry.isVerified(wallet);
    console.log(`Wallet: ${wallet}`);
    console.log(`Identity: ${identityAddress}`);
    console.log(`Claim issuer: ${claimIssuerAddress}`);
    console.log(`Verified: ${isVerified}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});