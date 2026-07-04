import hardhat from "hardhat";
import { writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const { ethers } = hardhat;

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying SentinelPayment with:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

  // 0.001 ETH minimum deposit
  const minDepositWei = ethers.parseEther("0.001");

  const SentinelPayment = await ethers.getContractFactory("SentinelPayment");
  const contract = await SentinelPayment.deploy(minDepositWei);
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  const network = await ethers.provider.getNetwork();
  const chainId = Number(network.chainId);
  const explorerBase =
    chainId === 84532 ? "https://sepolia.basescan.org" : "https://sepolia.etherscan.io";

  console.log("SentinelPayment deployed to:", address);
  console.log("Chain ID:", chainId);
  console.log("Explorer:", `${explorerBase}/address/${address}`);

  const info = {
    address,
    chainId,
    minDepositWei: minDepositWei.toString(),
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
  };

  const outPath = join(__dirname, "..", "contract_info.json");
  writeFileSync(outPath, JSON.stringify(info, null, 2));
  console.log("Wrote contract_info.json");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
