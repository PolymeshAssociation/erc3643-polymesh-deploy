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
    const action = (getArg(args, "action", "") || "").toLowerCase();

    if (action !== "pause" && action !== "unpause") {
        throw new Error("Missing or invalid --action. Use --action pause or --action unpause.");
    }

    const deployments = loadDeployments();
    const tokenAddress = getArg(args, "token") || requireDeployment(deployments, "token", "token");

    await getDeployer();

    const token = await ethers.getContractAt("IToken", tokenAddress);
    const currentlyPaused = await token.paused();

    console.log(`Token: ${tokenAddress}`);
    console.log(`Current paused state: ${currentlyPaused}`);

    if (action === "pause") {
        if (currentlyPaused) {
            console.log("Token is already paused. Nothing to do.");
            return;
        }
        const tx = await token.pause();
        await tx.wait();
        console.log(`Pause transaction: ${tx.hash}`);
    } else {
        if (!currentlyPaused) {
            console.log("Token is already unpaused. Nothing to do.");
            return;
        }
        const tx = await token.unpause();
        await tx.wait();
        console.log(`Unpause transaction: ${tx.hash}`);
    }

    const finalState = await token.paused();
    console.log(`Final paused state: ${finalState}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
