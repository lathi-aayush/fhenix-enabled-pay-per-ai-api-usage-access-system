import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-ethers";
import "@cofhe/hardhat-plugin";
import "dotenv/config";

const deployerKey =
  process.env.DEPLOYER_PRIVATE_KEY || process.env.PRIVATE_KEY || "";

const config: HardhatUserConfig = {
  cofhe: {
    logMocks: true,
    gasWarning: true,
  },
  solidity: {
    version: "0.8.25",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: "cancun",
    },
  },
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {},
    // CoFHE plugin also injects eth-sepolia; we define it here to use DEPLOYER_PRIVATE_KEY + RPC_URL from .env
    "eth-sepolia": {
      url:
        process.env.RPC_URL ||
        process.env.SEPOLIA_RPC_URL ||
        "https://ethereum-sepolia-rpc.publicnode.com",
      chainId: 11155111,
      accounts: deployerKey ? [deployerKey] : [],
      gasMultiplier: 1.2,
      timeout: 60000,
    },
    "base-sepolia": {
      url: process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org",
      chainId: 84532,
      accounts: deployerKey ? [deployerKey] : [],
      gasMultiplier: 1.2,
      timeout: 60000,
    },
  },
  etherscan: {
    apiKey: {
      "eth-sepolia": process.env.ETHERSCAN_API_KEY || "",
      "base-sepolia": process.env.BASESCAN_API_KEY || "",
    },
  },
};

export default config;
