import { ethers } from "hardhat";
import {
    deriveIdentitySalt,
    getArg,
    getDeployer,
    hasFlag,
    loadDeployments,
    parseArgs,
    requireArg,
    requireDeployment,
} from "./helpers";

async function ensureRegisteredInvestor(
    wallet: string,
    country: number,
    salt: string,
    deployments: ReturnType<typeof loadDeployments>
) {
    const idFactoryAddress = requireDeployment(deployments, "idFactory", "idFactory");
    const identityRegistryAddress = requireDeployment(
        deployments,
        "identityRegistry",
        "identityRegistry"
    );

    const idFactory = await ethers.getContractAt("IIdFactory", idFactoryAddress);
    const identityRegistry = await ethers.getContractAt(
        "IIdentityRegistry",
        identityRegistryAddress
    );

    let identityAddress = await idFactory.getIdentity(wallet);
    if (identityAddress === ethers.ZeroAddress) {
        const createTx = await idFactory.createIdentity(wallet, salt);
        await createTx.wait();
        identityAddress = await idFactory.getIdentity(wallet);
    }

    const isRegistered = await identityRegistry.contains(wallet);
    if (!isRegistered) {
        const registerTx = await identityRegistry.registerIdentity(wallet, identityAddress, country);
        await registerTx.wait();
    }
}

async function main() {
    const args = parseArgs();
    const to = requireArg(args, "to");
    const amount = requireArg(args, "amount");
    const country = Number(getArg(args, "country", "840"));
    const salt = getArg(args, "salt", deriveIdentitySalt(to));
    const autoRegister = hasFlag(args, "register-if-needed");
    const deployments = loadDeployments();

    const tokenAddress = requireDeployment(deployments, "token", "token");
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

    if (autoRegister) {
        await ensureRegisteredInvestor(to, country, salt!, deployments);
    }

    const token = await ethers.getContractAt("IToken", tokenAddress);
    const identityRegistry = await ethers.getContractAt(
        "IIdentityRegistry",
        identityRegistryAddress
    );
    const claimTopicsRegistry = await ethers.getContractAt(
        "IClaimTopicsRegistry",
        claimTopicsRegistryAddress
    );

    const decimals = Number(await token.decimals());
    const parsedAmount = ethers.parseUnits(amount, decimals);
    const isVerified = await identityRegistry.isVerified(to);

    if (!isVerified) {
        const claimTopics = await claimTopicsRegistry.getClaimTopics();
        throw new Error(
            `Recipient ${to} is not verified. Claim topics: ${claimTopics.map(String).join(", ") || "none"}. Run token:prepare-investor first and, for local testing, clear claim topics if you did not set up trusted issuers and claims.`
        );
    }

    const tx = await token.mint(to, parsedAmount);
    await tx.wait();

    const balance = await token.balanceOf(to);
    console.log(`Minted ${amount} tokens to ${to}`);
    console.log(`Balance is now ${ethers.formatUnits(balance, decimals)}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});