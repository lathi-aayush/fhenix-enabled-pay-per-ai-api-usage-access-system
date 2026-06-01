import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import algosdk from "algosdk";
import crypto from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getAlgodClient(network) {
  const isMainnet = network.toLowerCase() === "mainnet";
  const server = isMainnet
    ? "https://mainnet-api.algonode.cloud"
    : "https://testnet-api.algonode.cloud";
  return new algosdk.Algodv2("", server, "");
}

function getArc4Selector(signature) {
  const hash = crypto.createHash("sha512-256");
  hash.update(signature);
  return hash.digest().slice(0, 4);
}

function findTealFiles() {
  // Candidate paths
  const candidates = [
    // Relative to workspace root (cwd)
    path.join(process.cwd(), "contract", "artifacts"),
    path.join(process.cwd(), "artifacts"),
    // Relative to this script inside package
    path.join(__dirname, "..", "..", "contract", "artifacts"),
  ];

  for (const dir of candidates) {
    if (fs.existsSync(dir)) {
      const approval = path.join(dir, "SentinelContract.approval.teal");
      const clear = path.join(dir, "SentinelContract.clear.teal");
      if (fs.existsSync(approval) && fs.existsSync(clear)) {
        return { approvalPath: approval, clearPath: clear, dir };
      }
    }
  }
  throw new Error("Could not locate SentinelContract.approval.teal or SentinelContract.clear.teal artifacts.");
}

export async function runDeploy(options) {
  const { network, mnemonic: deployMnemonic } = options;

  const rawMnemonic = (deployMnemonic || process.env.DEPLOYER_MNEMONIC || "").trim();
  if (!rawMnemonic) {
    throw new Error("Mnemonic is required. Pass --mnemonic or set DEPLOYER_MNEMONIC in environment.");
  }

  // Find approval/clear programs
  const { approvalPath, clearPath, dir } = findTealFiles();
  console.log(`Using contract artifacts from: ${dir}`);

  const approvalTeal = fs.readFileSync(approvalPath, "utf-8");
  const clearTeal = fs.readFileSync(clearPath, "utf-8");

  const client = getAlgodClient(network);
  console.log(`Connecting to Algorand ${network}...`);

  console.log("Compiling contract TEAL on-chain...");
  const approvalResult = await client.compile(approvalTeal).do();
  const clearResult = await client.compile(clearTeal).do();

  const approvalBytes = Buffer.from(approvalResult.result, "base64");
  const clearBytes = Buffer.from(clearResult.result, "base64");

  const account = algosdk.mnemonicToSecretKey(rawMnemonic);
  const sender = account.addr;
  const suggested = await client.getTransactionParams().do();

  // Signature matching create_application(uint64)void
  const createSig = getArc4Selector("create_application(uint64)void");
  const minMicro = Number(process.env.SENTINEL_MIN_MICRO_ALGOS || 1000000);
  
  // App arg: method selector + minPayment (8-byte big endian uint64)
  const minMicroBuf = Buffer.alloc(8);
  minMicroBuf.writeBigUInt64BE(BigInt(minMicro));
  const appArgs = [createSig, minMicroBuf];

  console.log(`Broadcasting ApplicationCreateTxn from deployer: ${sender}...`);
  const txn = algosdk.makeApplicationCreateTxnFromObject({
    sender,
    suggestedParams: suggested,
    onComplete: algosdk.OnComplete.NoOpOC,
    approvalProgram: approvalBytes,
    clearProgram: clearBytes,
    numGlobalInts: 3,
    numGlobalByteSlices: 0,
    numLocalInts: 0,
    numLocalByteSlices: 0,
    appArgs,
  });

  const signed = txn.signTxn(account.sk);
  const { txId } = await client.sendRawTransaction(signed).do();
  console.log(`Transaction submitted successfully! Tx ID: ${txId}`);

  console.log("Waiting for confirmation on-chain...");
  const status = await algosdk.waitForConfirmation(client, txId, 4);
  const appId = status["application-index"];
  const appAddress = algosdk.getApplicationAddress(appId);

  console.log("\n========================================");
  console.log("DEPLOYMENT SUCCESSFUL!");
  console.log(`Application ID:   ${appId}`);
  console.log(`Contract Address: ${appAddress}`);
  console.log("========================================\n");

  // Save new contract info config file locally
  const infoPath = path.join(path.dirname(dir), "contract_info.json");
  const config = { appId: Number(appId), contractAddress: appAddress };
  fs.writeFileSync(infoPath, JSON.stringify(config, null, 2), "utf-8");
  console.log(`Updated configuration saved at: ${infoPath}`);
}
