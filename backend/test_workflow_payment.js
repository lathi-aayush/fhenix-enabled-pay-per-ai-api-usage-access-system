import mongoose from "mongoose";
import dotenv from "dotenv";
import algosdk from "algosdk";
import { User } from "./src/models/User.js";
import { Workflow } from "./src/models/Workflow.js";
import { WorkflowRun } from "./src/models/WorkflowRun.js";
import { ApiUsageLog } from "./src/models/ApiUsageLog.js";
import { encryptSecret } from "./src/utils/encrypt.js";
import {
  createPaymentChallenge,
  verifyAndCharge,
} from "./src/services/x402PaymentService.js";

dotenv.config();

// The funded mnemonic from test_profile_burner.js / test_x402_real_payment.js
const MNEMONIC = "lecture rocket indicate pig veteran mixed planet above eye link crime island opera pass frost butter surprise narrow cook stable hunt topic city ability gown";

async function runTest() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB!");

    // 1. Recover sender account from MNEMONIC
    const account = algosdk.mnemonicToSecretKey(MNEMONIC);
    const senderAddress = account.addr;
    console.log(`Test Sender Wallet Address: ${senderAddress}`);

    // Set up Algod client to broadcast raw payment tx for verification
    const algodUrl = process.env.ALGORAND_NODE || "https://testnet-api.algonode.cloud";
    const algodClient = new algosdk.Algodv2("", algodUrl, "");

    // Check balance
    const accountInfo = await algodClient.accountInformation(senderAddress).do();
    const balanceAlgos = Number(accountInfo.amount) / 1_000_000;
    console.log(`Test Sender Wallet Balance: ${balanceAlgos} ALGO`);
    if (balanceAlgos < 0.05) {
      throw new Error("Insufficient TestNet wallet balance to perform live payment integration tests.");
    }

    // 2. Create or find test user in MongoDB
    console.log("\n--- Creating or fetching test user in MongoDB ---");
    let testUser = await User.findOne({ email: "test-workflow-buyer@sentinel.ai" });
    if (!testUser) {
      testUser = await User.create({
        email: "test-workflow-buyer@sentinel.ai",
        displayName: "Test Workflow Buyer",
        role: "user",
        walletAddress: senderAddress,
        burnerWalletEncrypted: encryptSecret(MNEMONIC),
      });
      console.log(`Created new test user: ${testUser._id}`);
    } else {
      testUser.walletAddress = senderAddress;
      testUser.burnerWalletEncrypted = encryptSecret(MNEMONIC);
      await testUser.save();
      console.log(`Using existing test user: ${testUser._id}`);
    }

    // 3. Create a test workflow
    console.log("\n--- Creating mock workflow in MongoDB ---");
    const testWorkflow = await Workflow.create({
      userId: testUser._id,
      name: "Payment Security Integration Test Workflow",
      description: "Automated test workflow for on-chain billing security",
      nodes: [
        { id: "node_in", type: "input", data: { label: "Input", value: "test" } },
        { id: "node_ai", type: "ai", data: { label: "AI node", estimatedCredits: 0.005 } },
      ],
      edges: [],
    });
    console.log(`Created test workflow: ${testWorkflow._id}`);

    // 4. Generate challenge
    const estimatedCredits = 0.0001;
    const challenge = createPaymentChallenge(testUser._id, testWorkflow._id, "test_run_123", estimatedCredits);
    console.log("Generated Payment Challenge:\n", JSON.stringify(challenge, null, 2));

    // ─── TEST 1: Empty / Missing proof ───
    console.log("\n--- TEST 1: Verifying rejection of empty/missing paymentProof ---");
    const res1 = await verifyAndCharge({ paymentProof: null, challenge, estimatedCredits });
    console.log("Result 1:", res1);
    if (res1.success) throw new Error("TEST 1 FAILED: Empty proof was accepted!");
    console.log("✅ TEST 1 passed (rejected correctly).");

    // ─── TEST 2: Dummy transaction hash ───
    console.log("\n--- TEST 2: Verifying rejection of dummy/invalid transaction hash ---");
    const res2 = await verifyAndCharge({ paymentProof: "DUMMY_TX_HASH_XYZ", challenge, estimatedCredits });
    console.log("Result 2:", res2);
    if (res2.success) throw new Error("TEST 2 FAILED: Dummy transaction hash was accepted!");
    console.log("✅ TEST 2 passed (rejected correctly).");

    // ─── TEST 3: Construct, sign, and broadcast a real payment txn ───
    console.log("\n--- TEST 3: Sending actual transaction on TestNet ---");
    const params = await algodClient.getTransactionParams().do();
    const receiver = challenge.recipient;
    const amountMicroAlgos = Math.max(1000, Math.ceil(challenge.amount * 1_000_000));
    
    console.log(`Paying ${amountMicroAlgos} microAlgos to ${receiver}...`);
    const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      sender: senderAddress,
      receiver: receiver,
      amount: BigInt(amountMicroAlgos),
      suggestedParams: params,
      note: new TextEncoder().encode(`workflow:${challenge.metadata.workflowId}`),
    });

    const signedTxn = txn.signTxn(account.sk);
    const txId = txn.txID();
    console.log(`TxId generated: ${txId}`);
    
    await algodClient.sendRawTransaction(signedTxn).do();
    console.log("Transaction broadcasted successfully. Waiting for confirmation on-chain...");

    // Wait for node confirmation using official SDK helper
    console.log("Waiting for confirmation using waitForConfirmation...");
    const confirmation = await algosdk.waitForConfirmation(algodClient, txId, 5);
    console.log(`Transaction confirmed in round ${confirmation["confirmed-round"]}!`);

    // ─── TEST 4: Verify the legitimate transaction ───
    console.log("\n--- TEST 4: Verifying the real on-chain payment proof ---");
    const res4 = await verifyAndCharge({ paymentProof: txId, challenge, estimatedCredits });
    console.log("Result 4:", res4);
    if (!res4.success || !res4.verified) {
      throw new Error(`TEST 4 FAILED: Valid transaction proof rejected: ${res4.error}`);
    }
    console.log("✅ TEST 4 passed (successfully verified and accepted!).");

    // Create a workflow run logging this txn to test replay protection
    await WorkflowRun.create({
      workflowId: testWorkflow._id,
      userId: testUser._id,
      status: "completed",
      txHash: txId,
      estimatedCredits,
    });
    console.log("Logged successful run using this transaction hash.");

    // ─── TEST 5: Verify replay protection ───
    console.log("\n--- TEST 5: Verifying replay protection (same tx ID again) ---");
    const res5 = await verifyAndCharge({ paymentProof: txId, challenge, estimatedCredits });
    console.log("Result 5:", res5);
    if (res5.success) {
      throw new Error("TEST 5 FAILED: Replay transaction was accepted!");
    }
    console.log("✅ TEST 5 passed (replay successfully blocked!).");

    // Clean up DB mock records
    console.log("\nCleaning up test artifacts from database...");
    await Workflow.deleteOne({ _id: testWorkflow._id });
    await WorkflowRun.deleteOne({ txHash: txId });
    await User.deleteOne({ _id: testUser._id });
    console.log("DB cleaned up successfully.");

    console.log("\n🎉 ALL PAYMENT SECURITY INTEGRATION TESTS PASSED SUCCESSFULLY!");

  } catch (err) {
    console.error("\n❌ Payment Security Integration Test FAILED:", err.message || err);
    // Cleanup if possible
    try {
      await Workflow.deleteMany({ name: "Payment Security Integration Test Workflow" });
    } catch {}
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB.");
  }
}

runTest();
