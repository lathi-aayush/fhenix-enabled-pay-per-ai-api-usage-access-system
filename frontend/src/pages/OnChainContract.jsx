import React, { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { api } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useWalletAction } from "../hooks/useWalletAction.js";
import { getNetworkConfig } from "../config/chain.js";
import {
  checkHasFheBalance,
  depositToSentinel,
  getContractAddress,
  getDecryptedBalanceWei,
  isCofheContractConfigured,
  resolveContractAddress,
} from "../wallet/cofheBalance.js";
import { getAddressUrl, getTxUrl } from "../utils/explorer.js";

function formatEth(wei) {
  if (wei == null) return "—";
  const eth = Number(wei) / 1e18;
  if (eth === 0) return "0 ETH";
  if (eth < 0.000001) return `${eth.toExponential(2)} ETH`;
  return `${eth.toFixed(6)} ETH`;
}

export default function OnChainContract() {
  const { user } = useAuth();
  const { runWithWallet } = useWalletAction();
  const [stats, setStats] = useState(null);
  const [topupAmountWei, setTopupAmountWei] = useState("");
  const [loading, setLoading] = useState(true);
  const [depositing, setDepositing] = useState(false);
  const [balanceWei, setBalanceWei] = useState(null);
  const [hasBalance, setHasBalance] = useState(false);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [lastTxHash, setLastTxHash] = useState("");
  const [fheStatus, setFheStatus] = useState(null);

  const net = getNetworkConfig(stats?.chainId);
  const contractAddr = getContractAddress() || stats?.contractAddress || "";

  const loadStats = useCallback(async () => {
    try {
      const { data } = await api.get("/api/contract/stats");
      setStats(data);
      setFheStatus(data?.fhe ?? null);
      await resolveContractAddress();
    } catch {
      toast.error("Could not load contract stats");
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshBalance = useCallback(async () => {
    if (!user?.walletAddress || !isCofheContractConfigured()) return;
    setBalanceLoading(true);
    try {
      const has = await checkHasFheBalance(user.walletAddress);
      setHasBalance(has);
      if (has) {
        const wei = await getDecryptedBalanceWei();
        setBalanceWei(wei);
      } else {
        setBalanceWei(0n);
      }
    } catch (e) {
      setBalanceWei(null);
      toast.error(e?.message || "Could not decrypt balance");
    } finally {
      setBalanceLoading(false);
    }
  }, [user?.walletAddress]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    if (user?.walletAddress) refreshBalance();
  }, [user?.walletAddress, refreshBalance]);

  const handleTopUp = async () => {
    const wei = topupAmountWei.trim() || stats?.minDepositWei;
    if (!wei || BigInt(wei) <= 0n) {
      toast.error("Enter a valid deposit amount");
      return;
    }

    setDepositing(true);
    try {
      const { data: intent } = await api.post("/api/wallet/topup/create");
      const amount = BigInt(wei);
      const min = BigInt(intent.amountWei || "0");
      if (amount < min) {
        toast.error(`Minimum deposit is ${intent.amountEth} ETH`);
        return;
      }

      const { txHash } = await depositToSentinel(amount);
      setLastTxHash(txHash);

      await api.post("/api/wallet/topup/verify", {
        txHash,
        paymentIntentId: intent.paymentIntentId,
      });

      toast.success("Encrypted balance topped up");
      await refreshBalance();
    } catch (e) {
      toast.error(e?.response?.data?.error || e?.message || "Deposit failed");
    } finally {
      setDepositing(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-sm text-slate-500">Loading contract info…</div>;
  }

  const configured = isCofheContractConfigured() || Boolean(stats?.contractAddress);

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#031634]">FHE Smart Contract</h1>
        <p className="text-sm text-slate-600 mt-1">
          Prepaid balance on <code className="text-xs">SentinelPayment</code> — stored as encrypted{" "}
          <code className="text-xs">euint64</code> on {net.name}. Only you can unseal your balance.
        </p>
      </div>

      {!configured && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Contract not configured. Deploy <code>SentinelPayment.sol</code>, set{" "}
          <code>CONTRACT_ADDRESS</code> in backend and optionally <code>VITE_CONTRACT_ADDRESS</code> in frontend.
        </div>
      )}

      {configured && fheStatus && !fheStatus.ready && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          FHE deductions not active on the server ({fheStatus.reason || "not ready"}).
          Set <code>OPERATOR_PRIVATE_KEY</code> to the contract deployer (owner) in backend <code>.env</code>.
          {fheStatus.error ? ` — ${fheStatus.error}` : ""}
        </div>
      )}

      <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Contract</h2>
        <dl className="grid gap-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">Network</dt>
            <dd>{stats?.network || net.name} (chain {stats?.chainId || net.chainId})</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">Address</dt>
            <dd className="font-mono text-xs break-all">
              {contractAddr ? (
                <a
                  href={getAddressUrl(contractAddr)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-indigo-600 hover:underline"
                >
                  {contractAddr}
                </a>
              ) : (
                "—"
              )}
            </dd>
          </div>
        </dl>
      </div>

      <div className="rounded-lg border border-cyan-200 bg-cyan-50/40 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-cyan-800">
            Encrypted balance
          </h2>
          <button
            type="button"
            onClick={() => runWithWallet(() => refreshBalance())}
            disabled={balanceLoading || !configured}
            className="text-xs font-medium text-cyan-700 hover:underline disabled:opacity-50"
          >
            {balanceLoading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
        <p className="text-3xl font-bold text-[#031634] tabular-nums">
          {balanceLoading ? "…" : formatEth(balanceWei)}
        </p>
        <p className="text-xs text-slate-600">
          {hasBalance
            ? "Decrypted locally via CoFHE permit — not visible on-chain."
            : "No encrypted balance yet. Deposit below to pay per API call without x402."}
        </p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Top up</h2>
        <label className="block text-sm">
          <span className="text-slate-600">Amount (wei)</span>
          <input
            type="text"
            placeholder="1000000000000000 (0.001 ETH min)"
            value={topupAmountWei}
            onChange={(e) => setTopupAmountWei(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm font-mono"
          />
        </label>
        <button
          type="button"
          disabled={depositing || !configured}
          onClick={() => runWithWallet(() => handleTopUp())}
          className="w-full sm:w-auto bg-[#031634] text-white px-6 py-2.5 rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          {depositing ? "Depositing…" : "Deposit via MetaMask"}
        </button>
        {lastTxHash && (
          <p className="text-xs text-slate-600">
            Last deposit:{" "}
            <a
              href={getTxUrl(lastTxHash)}
              target="_blank"
              rel="noreferrer"
              className="text-indigo-600 hover:underline font-mono"
            >
              {lastTxHash.slice(0, 10)}…
            </a>
          </p>
        )}
      </div>

      <div className="rounded-lg border border-slate-100 bg-slate-50 p-4 text-xs text-slate-600 space-y-1">
        <p>
          <strong>Payment flow:</strong> API calls try your FHE balance first (encrypted deduct). If
          empty, x402 ETH payment is used instead.
        </p>
        <p>
          Docs:{" "}
          <a
            href="https://cofhe-docs.fhenix.zone/"
            target="_blank"
            rel="noreferrer"
            className="text-indigo-600 hover:underline"
          >
            cofhe-docs.fhenix.zone
          </a>
        </p>
      </div>
    </div>
  );
}
