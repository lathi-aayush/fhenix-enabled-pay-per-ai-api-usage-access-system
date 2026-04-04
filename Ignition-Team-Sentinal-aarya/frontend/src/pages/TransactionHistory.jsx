import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { api } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import UserLiveWalletBar from "../components/UserLiveWalletBar.jsx";

const EXPLORER_TX = "https://testnet.algoexplorer.io/tx/";

export default function TransactionHistory() {
  const { user, logout } = useAuth();
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState({ totalCalls: 0, totalTokensConsumed: 0, totalAlgoSpent: 0 });
  const [services, setServices] = useState([]);
  const [serviceId, setServiceId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [loading, setLoading] = useState(true);

  const query = useMemo(() => {
    const p = new URLSearchParams();
    p.set("limit", "200");
    if (serviceId) p.set("serviceId", serviceId);
    if (startDate) p.set("startDate", startDate);
    if (endDate) p.set("endDate", endDate);
    p.set("sortBy", sortBy);
    return p.toString();
  }, [serviceId, startDate, endDate, sortBy]);

  async function load() {
    setLoading(true);
    try {
      const [{ data: tx }, { data: svcList }] = await Promise.all([
        api.get(`/api/user/transactions?${query}`),
        api.get("/api/services").catch(() => ({ data: [] })),
      ]);
      setItems(tx?.items ?? []);
      setSummary(tx?.summary ?? { totalCalls: 0, totalTokensConsumed: 0, totalAlgoSpent: 0 });
      setServices(Array.isArray(svcList) ? svcList : []);
    } catch {
      toast.error("Failed to load transactions");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [query]);

  return (
    <div className="antialiased min-h-screen bg-[#f9f9f9]">
      <header className="bg-white fixed top-0 z-50 w-full border-b border-slate-100 h-16 px-6 flex justify-between items-center font-body text-sm">
        <div className="flex items-center gap-6">
          <Link to="/user/marketplace" className="text-secondary hover:underline">
            ← Marketplace
          </Link>
          <span className="font-headline font-semibold text-primary">Transaction history</span>
        </div>
        <div className="flex items-center gap-4">
          <UserLiveWalletBar walletAddress={user?.walletAddress} />
          <button type="button" onClick={() => logout()} className="text-slate-500 text-sm">
            Sign out
          </button>
        </div>
      </header>

      <main className="pt-24 px-4 sm:px-6 pb-24 max-w-6xl mx-auto">
        <div className="flex flex-wrap gap-3 mb-6 items-end">
          <div>
            <label className="block text-xs text-on-surface-variant mb-1">Service</label>
            <select
              className="border border-outline-variant rounded-md px-2 py-2 text-sm min-w-[180px]"
              value={serviceId}
              onChange={(e) => setServiceId(e.target.value)}
            >
              <option value="">All services</option>
              {services.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-on-surface-variant mb-1">From</label>
            <input
              type="date"
              className="border border-outline-variant rounded-md px-2 py-2 text-sm"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-on-surface-variant mb-1">To</label>
            <input
              type="date"
              className="border border-outline-variant rounded-md px-2 py-2 text-sm"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-on-surface-variant mb-1">Sort</label>
            <select
              className="border border-outline-variant rounded-md px-2 py-2 text-sm"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="charge_desc">Highest charge first</option>
              <option value="charge_asc">Lowest charge first</option>
            </select>
          </div>
          <button
            type="button"
            onClick={load}
            className="text-sm px-4 py-2 rounded-md bg-primary text-white"
          >
            Apply
          </button>
        </div>

        <div className="bg-white border border-surface-variant rounded-md overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-surface-container-low text-xs uppercase text-on-surface-variant">
              <tr>
                <th className="px-3 py-3">Date &amp; time</th>
                <th className="px-3 py-3">Service</th>
                <th className="px-3 py-3">Tokens</th>
                <th className="px-3 py-3">ALGO</th>
                <th className="px-3 py-3">Proof</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-on-surface-variant">
                    Loading…
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-on-surface-variant">
                    No rows match your filters.
                  </td>
                </tr>
              ) : (
                items.map((row) => (
                  <tr key={row.id} className="border-t border-surface-variant">
                    <td className="px-3 py-2 whitespace-nowrap text-on-surface-variant">
                      {row.createdAt ? new Date(row.createdAt).toLocaleString() : "—"}
                    </td>
                    <td className="px-3 py-2">{row.serviceTitle ?? "—"}</td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {(row.promptTokens ?? "—")} + {(row.completionTokens ?? "—")}
                    </td>
                    <td className="px-3 py-2 font-mono">{Number(row.chargeAlgo ?? row.amountAlgo).toFixed(6)}</td>
                    <td className="px-3 py-2">
                      {row.proofTxId ? (
                        <a
                          href={`${EXPLORER_TX}${row.proofTxId}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-secondary underline"
                        >
                          View proof
                        </a>
                      ) : (
                        <span className="text-on-surface-variant">pending</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {!loading && items.length > 0 && (
              <tfoot className="bg-surface-container-low font-medium">
                <tr>
                  <td colSpan={2} className="px-3 py-3">
                    Summary ({summary.totalCalls} calls)
                  </td>
                  <td className="px-3 py-3 font-mono">{summary.totalTokensConsumed.toLocaleString()} tok</td>
                  <td className="px-3 py-3 font-mono">{summary.totalAlgoSpent.toFixed(6)} ALGO</td>
                  <td className="px-3 py-3" />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </main>
    </div>
  );
}
