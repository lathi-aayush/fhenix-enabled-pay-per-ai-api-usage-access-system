import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import hre from "hardhat";
import { Encryptable, FheTypes } from "@cofhe/sdk";
import { expect } from "chai";

const TASK_COFHE_MOCKS_DEPLOY = "task:cofhe-mocks:deploy";

describe("SentinelPayment", function () {
  const MIN_DEPOSIT = hre.ethers.parseEther("0.001");

  async function deployFixture() {
    await hre.run(TASK_COFHE_MOCKS_DEPLOY);

    const [owner, user, service] = await hre.ethers.getSigners();

    const SentinelPayment = await hre.ethers.getContractFactory(
      "SentinelPayment",
    );
    const payment = await SentinelPayment.deploy(MIN_DEPOSIT);
    await payment.waitForDeployment();

    const userClient = await hre.cofhe.createClientWithBatteries(user);
    const ownerClient = await hre.cofhe.createClientWithBatteries(owner);

    return { payment, owner, user, service, userClient, ownerClient };
  }

  it("stores deposit as encrypted balance", async function () {
    const { payment, user } = await loadFixture(deployFixture);

    const depositWei = hre.ethers.parseEther("0.01");
    await payment.connect(user).deposit({ value: depositWei });

    expect(await payment.hasBalance(user.address)).to.equal(true);
    expect(await payment.totalDepositsWei()).to.equal(depositWei);
  });

  it("reverts deposit below minimum", async function () {
    const { payment, user } = await loadFixture(deployFixture);

    await expect(
      payment.connect(user).deposit({ value: MIN_DEPOSIT - 1n }),
    ).to.be.revertedWithCustomError(payment, "InsufficientDeposit");
  });

  it("owner deducts encrypted amount and balance decreases", async function () {
    const { payment, owner, user, service, userClient, ownerClient } =
      await loadFixture(deployFixture);

    const depositWei = hre.ethers.parseEther("0.01");
    await payment.connect(user).deposit({ value: depositWei });

    const before = await payment.connect(user).sealedBalance();
    const beforePlain = await userClient
      .decryptForView(before, FheTypes.Uint64)
      .execute();
    expect(beforePlain).to.equal(depositWei);

    const deductWei = hre.ethers.parseEther("0.0001");
    const [encAmount] = await ownerClient
      .encryptInputs([Encryptable.uint64(deductWei)])
      .execute();

    await payment
      .connect(owner)
      .deductForCall(user.address, encAmount, service.address);

    expect(await payment.serviceCallCount(service.address)).to.equal(1);

    const after = await payment.connect(user).sealedBalance();
    const afterPlain = await userClient
      .decryptForView(after, FheTypes.Uint64)
      .execute();
    expect(afterPlain).to.equal(depositWei - deductWei);
  });

  it("accumulates deposits on same user", async function () {
    const { payment, user, userClient } = await loadFixture(deployFixture);

    const first = hre.ethers.parseEther("0.01");
    const second = hre.ethers.parseEther("0.005");
    await payment.connect(user).deposit({ value: first });
    await payment.connect(user).deposit({ value: second });

    const sealed = await payment.connect(user).sealedBalance();
    const plain = await userClient
      .decryptForView(sealed, FheTypes.Uint64)
      .execute();
    expect(plain).to.equal(first + second);
    expect(await payment.totalDepositsWei()).to.equal(first + second);
  });
});
