import algosdk, { waitForConfirmation } from "algosdk";
import { ApiUsageLog } from "../models/ApiUsageLog.js";
import { Service } from "../models/Service.js";
import { Withdrawal } from "../models/Withdrawal.js";
import { algoToMicroAlgos, fetchAccountBalanceMicroAlgos } from "./algorandService.js";
import { canonicalWalletAddress, creatorServicesOwnedBy } from "../utils/userWallet.js";

export const MIN_WITHDRAWAL_ALGO = 0.1;

const SUCCESS_LOG_MATCH = {
  $or: [{ success: true }, { success: { $exists: false } }],
};

function roundAlgo(value) {
  return Math.round(Number(value) * 1e6) / 1e6;
}

function getAlgodClient() {
  const server = (
    process.env.ALGOD_SERVER ||
    process.env.ALGORAND_NODE ||
    "https://testnet-api.algonode.cloud"
  ).replace(/\/$/, "");
  const token = process.env.ALGOD_TOKEN || "";
  return new algosdk.Algodv2(token, server, "");
}

function getPlatformTreasuryKey() {
  const mn = process.env.PLATFORM_MNEMONIC?.trim();
  if (!mn) {
    throw new Error("Platform treasury is not configured (PLATFORM_MNEMONIC missing)");
  }
  return algosdk.mnemonicToSecretKey(mn);
}

async function getCreatorServiceIds(creatorWallet) {
  const services = await Service.find(creatorServicesOwnedBy(creatorWallet)).select("_id").lean();
  return services.map((s) => s._id);
}

export async function computeCreatorWithdrawalBalances(creatorWallet) {
  const wallet = canonicalWalletAddress(creatorWallet);
  const serviceIds = await getCreatorServiceIds(wallet);

  let totalEarned = 0;
  if (serviceIds.length > 0) {
    const [earnedRow] = await ApiUsageLog.aggregate([
      {
        $match: {
          serviceId: { $in: serviceIds },
          ...SUCCESS_LOG_MATCH,
        },
      },
      { $group: { _id: null, total: { $sum: "$amountAlgo" } } },
    ]);
    totalEarned = roundAlgo(earnedRow?.total ?? 0);
  }

  const [withdrawnRow, pendingRow] = await Promise.all([
    Withdrawal.aggregate([
      { $match: { creatorWallet: wallet, status: "completed" } },
      { $group: { _id: null, total: { $sum: "$amountAlgo" } } },
    ]),
    Withdrawal.aggregate([
      { $match: { creatorWallet: wallet, status: "pending" } },
      { $group: { _id: null, total: { $sum: "$amountAlgo" } } },
    ]),
  ]);

  const totalWithdrawn = roundAlgo(withdrawnRow[0]?.total ?? 0);
  const pendingWithdrawals = roundAlgo(pendingRow[0]?.total ?? 0);
  const withdrawable = roundAlgo(totalEarned - totalWithdrawn - pendingWithdrawals);

  return {
    totalEarned,
    totalWithdrawn,
    pendingWithdrawals,
    withdrawable: Math.max(0, withdrawable),
  };
}

async function submitTreasuryPayout({ creatorWallet, amountAlgo, withdrawalId }) {
  const { addr, sk } = getPlatformTreasuryKey();
  const receiver = canonicalWalletAddress(creatorWallet);
  const microAlgos = algoToMicroAlgos(amountAlgo);

  const treasuryBalance = await fetchAccountBalanceMicroAlgos(addr);
  if (treasuryBalance < microAlgos + 1000) {
    throw new Error("Platform treasury has insufficient balance for this withdrawal");
  }

  const client = getAlgodClient();
  const sp = await client.getTransactionParams().do();
  const note = new Uint8Array(
    Buffer.from(`sentinel:withdraw:${String(withdrawalId)}`, "utf8")
  );

  const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender: addr,
    receiver,
    amount: microAlgos,
    note,
    suggestedParams: sp,
  });
  const signed = txn.signTxn(sk);
  const { txId } = await client.sendRawTransaction(signed).do();
  await waitForConfirmation(client, txId, 6);
  return txId;
}

export async function listCreatorWithdrawals(creatorWallet, { limit = 50 } = {}) {
  const wallet = canonicalWalletAddress(creatorWallet);
  const cap = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const rows = await Withdrawal.find({ creatorWallet: wallet })
    .sort({ createdAt: -1 })
    .limit(cap)
    .lean();

  return rows.map((row) => ({
    id: row._id,
    amountAlgo: roundAlgo(row.amountAlgo),
    status: row.status,
    txId: row.txId ?? null,
    errorDetail: row.errorDetail ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));
}

export async function requestCreatorWithdrawal({ creatorWallet, userId, amountAlgo }) {
  const wallet = canonicalWalletAddress(creatorWallet);
  const amount = roundAlgo(amountAlgo);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw Object.assign(new Error("Amount must be a positive number"), { status: 400 });
  }
  if (amount < MIN_WITHDRAWAL_ALGO) {
    throw Object.assign(new Error(`Minimum withdrawal is ${MIN_WITHDRAWAL_ALGO} ALGO`), { status: 400 });
  }

  const balances = await computeCreatorWithdrawalBalances(wallet);
  if (amount > balances.withdrawable) {
    throw Object.assign(new Error("Requested amount exceeds withdrawable balance"), {
      status: 400,
      balances,
    });
  }

  const withdrawal = await Withdrawal.create({
    creatorWallet: wallet,
    userId,
    amountAlgo: amount,
    status: "pending",
  });

  try {
    const txId = await submitTreasuryPayout({
      creatorWallet: wallet,
      amountAlgo: amount,
      withdrawalId: withdrawal._id,
    });
    withdrawal.status = "completed";
    withdrawal.txId = txId;
    withdrawal.errorDetail = undefined;
    await withdrawal.save();
  } catch (err) {
    withdrawal.status = "failed";
    withdrawal.errorDetail = String(err?.message || err).slice(0, 500);
    await withdrawal.save();
    throw Object.assign(new Error(withdrawal.errorDetail), { status: 502, withdrawalId: withdrawal._id });
  }

  const updatedBalances = await computeCreatorWithdrawalBalances(wallet);
  return {
    withdrawal: {
      id: withdrawal._id,
      amountAlgo: amount,
      status: withdrawal.status,
      txId: withdrawal.txId,
      createdAt: withdrawal.createdAt,
    },
    ...updatedBalances,
  };
}
