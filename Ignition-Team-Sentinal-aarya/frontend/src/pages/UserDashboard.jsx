import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { api } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import {
  addressesEqual,
  connectPera,
  normalizeAccountAddress,
  reconnectPera,
  signAndSendPayment,
} from "../wallet/pera.js";

export default function UserDashboard() {
  const { user, logout } = useAuth();
  const [balanceAlgo, setBalanceAlgo] = useState(null);
  const [keys, setKeys] = useState([]);
  const [usage, setUsage] = useState([]);
  const [loading, setLoading] = useState(true);
  const [topupAmount, setTopupAmount] = useState("1");
  const [toppingUp, setToppingUp] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [b, k, u] = await Promise.all([
        api.get("/api/user/balance"),
        api.get("/api/user/proxy-keys"),
        api.get("/api/user/usage?limit=50"),
      ]);
      setBalanceAlgo(b.data?.balanceAlgo ?? 0);
      setKeys(k.data ?? []);
      setUsage(u.data ?? []);
    } catch {
      toast.error("Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function runTopUp() {
    const amt = parseFloat(topupAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error("Enter a valid ALGO amount");
      return;
    }
    const sessionWallet = normalizeAccountAddress(user?.walletAddress);
    if (!sessionWallet) {
      toast.error("Session missing wallet");
      return;
    }
    setToppingUp(true);
    try {
      let active = await reconnectPera();
      if (!active) active = await connectPera();
      if (!active || !(await addressesEqual(active, sessionWallet))) {
        toast.error("Pera account must match your signed-in wallet");
        return;
      }
      const { data: intent } = await api.post("/api/wallet/topup/create", {
        amountAlgo: amt,
      });
      const receiver = normalizeAccountAddress(intent?.receiver);
      const micro = Number(intent?.amountMicroAlgos);
      if (!receiver || !Number.isFinite(micro) || micro <= 0) {
        toast.error("Invalid top-up details from server");
        return;
      }
      const { txId } = await signAndSendPayment({
        from: active,
        to: receiver,
        amountMicroAlgos: micro,
        noteStr: intent.note,
        algodServer: intent.algodServer,
      });
      toast.success("Transaction sent. Verifying…");
      const { data: verified } = await api.post("/api/wallet/topup/verify", {
        txId,
        paymentIntentId: intent.paymentIntentId,
      });
      if (verified?.status === "verified") {
        setBalanceAlgo(verified.balanceAlgo ?? balanceAlgo);
        toast.success(`Credited ${verified.creditedAlgo} ALGO`);
        await refresh();
      }
    } catch (e) {
      const d = e?.response?.data;
      toast.error(d?.error || e?.message || "Top-up failed");
    } finally {
      setToppingUp(false);
    }
  }

  return (
    <div className="antialiased min-h-screen bg-[#f9f9f9]">
      <header className="bg-white fixed top-0 z-50 w-full border-b border-slate-100 h-16 px-6 flex justify-between items-center font-body text-sm">
        <div className="flex items-center gap-8">
          <Link to="/" className="text-xl font-bold tracking-tight font-headline text-slate-900">
            Sentinal
          </Link>
        </div>
        <div className="flex items-center gap-4">
          <span className="font-mono text-xs truncate max-w-[160px]">{user?.walletAddress}</span>
          <button
            type="button"
            onClick={() => {
              logout();
              window.location.href = "/";
            }}
            className="text-slate-500 text-sm"
          >
            Sign out
          </button>
        </div>
      </header>

      <aside className="fixed left-0 top-16 bottom-0 w-64 bg-slate-50 border-r border-slate-100 flex-col py-8 text-[0.875rem] overflow-y-auto max-md:hidden md:flex">
        <Link
          to="/user/marketplace"
          className="flex items-center gap-3 px-6 py-3 text-slate-500 hover:bg-slate-100"
        >
          <span className="material-symbols-outlined">storefront</span>
          Marketplace
        </Link>
        <Link
          to="/user/dashboard"
          className="flex items-center gap-3 px-6 py-3 text-slate-900 font-semibold bg-slate-100 border-r-2 border-slate-900"
        >
          <span className="material-symbols-outlined">account_balance_wallet</span>
          Wallet &amp; keys
        </Link>
        <Link
          to="/user/analytics"
          className="flex items-center gap-3 px-6 py-3 text-slate-500 hover:bg-slate-100"
        >
          <span className="material-symbols-outlined">insights</span>
          Usage Analytics
        </Link>
      </aside>

      <main className="md:pl-64 pt-24 px-6 pb-16 max-w-4xl">
        <h1 className="font-headline text-2xl font-semibold text-primary mb-2">Wallet &amp; proxy keys</h1>
        <p className="text-sm text-on-surface-variant mb-8">
          Top up ALGO once, then use your proxy keys from any app without signing each request.
        </p>

        {loading ? (
          <p className="text-on-surface-variant">Loading…</p>
        ) : (
          <>
            <section className="bg-white border border-surface-variant rounded-md p-6 mb-8 editorial-shadow">
              <h2 className="font-semibold text-primary mb-4">Balance</h2>
              <p className="font-mono text-3xl text-secondary mb-6">
                {(balanceAlgo ?? 0).toFixed(6)} <span className="text-sm text-on-surface-variant">ALGO</span>
              </p>
              <div className="flex flex-wrap gap-3 items-end">
                <div>
                  <label className="block text-xs text-on-surface-variant mb-1">Top up amount (ALGO)</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    className="border border-outline-variant rounded-md px-3 py-2 text-sm w-40"
                    value={topupAmount}
                    onChange={(e) => setTopupAmount(e.target.value)}
                  />
                </div>
                <button
                  type="button"
                  disabled={toppingUp}
                  onClick={runTopUp}
                  className="bg-primary text-white px-5 py-2 rounded-md text-sm font-medium disabled:opacity-50"
                >
                  {toppingUp ? "Processing…" : "Top up with Pera"}
                </button>
              </div>
              <p className="text-xs text-on-surface-variant mt-3">
                Sends ALGO to the platform treasury with a verification note (TestNet). Same flow as marketplace payments.
              </p>
            </section>

            <section className="mb-10">
              <h2 className="font-semibold text-primary mb-4">Your proxy keys</h2>
              {keys.length === 0 ? (
                <p className="text-sm text-on-surface-variant">
                  No keys yet. Open a service in the marketplace and generate one.
                </p>
              ) : (
                <div className="space-y-3">
                  {keys.map((row) => (
                    <div
                      key={row.id}
                      className="bg-white border border-surface-variant rounded-md p-4 text-sm flex flex-col gap-1"
                    >
                      <p className="font-semibold">{row.service?.title ?? "Service"}</p>
                      <p className="text-on-surface-variant text-xs">
                        {row.service?.aiProvider} · {row.service?.modelName} ·{" "}
                        {Number(row.service?.price ?? 0).toFixed(4)} ALGO/call
                      </p>
                      <p className="font-mono text-xs break-all mt-2">{row.key}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section>
              <h2 className="font-semibold text-primary mb-4">Recent API usage</h2>
              {usage.length === 0 ? (
                <p className="text-sm text-on-surface-variant">No proxy calls recorded yet.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {usage.map((row) => (
                    <li
                      key={row.id}
                      className="bg-white border border-surface-variant rounded-md px-4 py-3 flex justify-between gap-4"
                    >
                      <span className="text-on-surface-variant">
                        {row.serviceTitle ?? "—"} · {row.aiProvider} / {row.modelName}
                      </span>
                      <span className="font-mono shrink-0">
                        {Number(row.amountAlgo).toFixed(4)} ALGO
                      </span>
                      <span className="text-xs text-on-surface-variant shrink-0">
                        {row.createdAt ? new Date(row.createdAt).toLocaleString() : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
