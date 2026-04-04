import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { api } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import UserLiveWalletBar from "../components/UserLiveWalletBar.jsx";

export default function UserDashboard() {
  const { user, logout } = useAuth();
  const [keys, setKeys] = useState([]);
  const [usage, setUsage] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const [k, u] = await Promise.all([
        api.get("/api/user/proxy-keys"),
        api.get("/api/user/usage?limit=50"),
      ]);
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

  useEffect(() => {
    function onVis() {
      if (document.visibilityState === "visible") refresh();
    }
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [refresh]);

  return (
    <div className="antialiased min-h-screen bg-[#f9f9f9]">
      <header className="bg-white fixed top-0 z-50 w-full border-b border-slate-100 h-16 px-4 sm:px-6 flex justify-between items-center font-body text-sm gap-2">
        <div className="flex items-center gap-4 min-w-0">
          <Link to="/" className="text-xl font-bold tracking-tight font-headline text-slate-900 shrink-0">
            Sentinal
          </Link>
        </div>
        <UserLiveWalletBar walletAddress={user?.walletAddress} />
        <button
          type="button"
          onClick={() => {
            logout();
            window.location.href = "/";
          }}
          className="text-slate-500 text-sm shrink-0"
        >
          Sign out
        </button>
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
          <span className="material-symbols-outlined">key</span>
          Keys &amp; usage
        </Link>
        <Link
          to="/user/analytics"
          className="flex items-center gap-3 px-6 py-3 text-slate-500 hover:bg-slate-100"
        >
          <span className="material-symbols-outlined">insights</span>
          Usage Analytics
        </Link>
        <Link
          to="/user/transactions"
          className="flex items-center gap-3 px-6 py-3 text-slate-500 hover:bg-slate-100"
        >
          <span className="material-symbols-outlined">receipt_long</span>
          Transaction history
        </Link>
      </aside>

      <main className="md:pl-64 pt-24 px-6 pb-16 max-w-4xl">
        <h1 className="font-headline text-2xl font-semibold text-primary mb-2">Proxy keys &amp; usage</h1>
        <p className="text-sm text-on-surface-variant mb-8">
          Payments are always direct from your Pera Wallet to the developer on each API call. No platform balance.
        </p>

        {loading ? (
          <p className="text-on-surface-variant">Loading…</p>
        ) : (
          <>
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
                        {Number(row.service?.pricePerThousandTokens ?? 0).toFixed(6)} ALGO/1k tok · min{" "}
                        {Number(row.service?.minimumChargeAlgo ?? 0).toFixed(6)} ALGO
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
                      className="bg-white border border-surface-variant rounded-md px-4 py-3 flex flex-wrap justify-between gap-2 items-center"
                    >
                      <span className="text-on-surface-variant">
                        {row.serviceTitle ?? "—"} · {row.aiProvider} / {row.modelName}
                      </span>
                      <span
                        className={
                          row.success === false
                            ? "text-xs px-2 py-0.5 rounded bg-amber-50 text-amber-900"
                            : "text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700"
                        }
                      >
                        {row.success === false ? "Paid · AI error" : "Completed"}
                      </span>
                      <span className="font-mono shrink-0 text-xs">
                        {Number(row.amountAlgo).toFixed(6)} ALGO
                        {row.totalTokens != null ? ` · ${row.totalTokens} tok` : ""}
                      </span>
                      {row.paymentTxId && (
                        <a
                          href={`https://testnet.algoexplorer.io/tx/${row.paymentTxId}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-secondary underline font-mono"
                        >
                          Tx
                        </a>
                      )}
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
