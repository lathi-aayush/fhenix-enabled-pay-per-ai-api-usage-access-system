import { expect } from "chai";
import { ethers } from "hardhat";
import hre from "hardhat";
import { Encryptable } from "@cofhe/sdk";
import { createCofheClient, createCofheConfig } from "@cofhe/sdk/node";
import { baseSepolia as cofheBaseSepolia } from "@cofhe/sdk/chains";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { hardhat } from "viem/chains";

describe("SentinelPayment (CoFHE)", function () {
  this.timeout(120000);

  let contract;
  let owner;
  let user;
  let service;

  beforeEach(async () => {
    [owner, user, service] = await ethers.getSigners();
    const minDeposit = ethers.parseEther("0.001");
    const Factory = await ethers.getContractFactory("SentinelPayment");
    contract = await Factory.deploy(minDeposit);
    await contract.waitForDeployment();
  });

  it("stores deposit as encrypted balance handle", async () => {
    const depositWei = ethers.parseEther("0.01");
    await contract.connect(user).deposit({ value: depositWei });
    expect(await contract.hasBalance(user.address)).to.equal(true);
    expect(await contract.totalDepositsWei()).to.equal(depositWei);
  });

  it("owner deducts encrypted amount via @cofhe/sdk", async function () {
    if (process.env.SKIP_COFHE_NETWORK_TESTS === "1") {
      this.skip();
    }
    const depositWei = ethers.parseEther("0.01");
    await contract.connect(user).deposit({ value: depositWei });

    const deductWei = ethers.parseEther("0.0001");
    const network = await ethers.provider.getNetwork();
    const rpcUrl = hre.network.config.url || "http://127.0.0.1:8545";

    const ownerPk = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
    const account = privateKeyToAccount(ownerPk);
    const publicClient = createPublicClient({
      chain: { ...hardhat, id: Number(network.chainId) },
      transport: http(rpcUrl),
    });
    const walletClient = createWalletClient({
      chain: { ...hardhat, id: Number(network.chainId) },
      transport: http(rpcUrl),
      account,
    });

    const config = createCofheConfig({ supportedChains: [cofheBaseSepolia] });
    const client = createCofheClient(config);
    await client.connect(publicClient, walletClient);

    const [encAmount] = await client
      .encryptInputs([Encryptable.uint64(deductWei)])
      .execute();

    await contract.connect(owner).deductForCall(user.address, encAmount, service.address);
    expect(await contract.serviceCallCount(service.address)).to.equal(1);
  });
});
