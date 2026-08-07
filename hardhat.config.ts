import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

const ALITH_PK =
  process.env.PRIVATE_KEY ||
  "0x5fb92d6e98884f76de468fa3f6278f8807c48bebc13595d45af5bdc4da702133";

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.8.17",
        settings: {
          optimizer: { enabled: true, runs: 200 },
        },
      },
      {
        // Some ONCHAINID / OpenZeppelin contracts may need 0.8.19+
        version: "0.8.19",
        settings: {
          optimizer: { enabled: true, runs: 200 },
        },
      },
    ],
  },
  networks: {
    polymeshLocal: {
      url: process.env.ETH_RPC_URL || "http://127.0.0.1:8545",
      accounts: [ALITH_PK],
      chainId: Number(process.env.CHAIN_ID) || 1641818,
      timeout: 180_000,
      gas: 30_000_000, // generous limit for large factory deployments
    },
    // Convenience: also allow hardhat network for offline testing
    hardhat: {
      chainId: 31337,
    },
  },
  paths: {
    sources: "./contracts",
    artifacts: "./artifacts",
    cache: "./cache",
  },
};

export default config;
