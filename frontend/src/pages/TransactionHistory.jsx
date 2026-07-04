import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { api } from "../api/client.js";
import { testnetTxUrl } from "../utils/explorer.js";

export default function TransactionHistory() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/api/user/transactions?limit=500");
      setItems(data?.items ?? []);
      setSummary(data?.summary ?? null);
    } catch {
      toast.error("Failed to load transactions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (loading) {
    return <div className="p-8 text-sm text-slate-500">Loading transactions…</div>;
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#031634]">Transaction History</h1>
        {summary && (
          <p className="text-sm text-slate-600 mt-1">
            {summary.totalCalls ?? 0} calls · {summary.totalEthSpent ?? 0} ETH spent
          </p>
        )}
      </div>
      <div className="rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-2">Service</th>
              <th className="px-4 py-2">ETH</th>
              <th className="px-4 py-2">Tx</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-slate-500">
                  No transactions yet
                </td>
              </tr>
            ) : (
              items.map((row) => (
                <tr key={row._id || row.txHash} className="border-t border-slate-100">
                  <td className="px-4 py-2">{row.serviceTitle || row.serviceId || "—"}</td>
                  <td className="px-4 py-2 font-mono">{row.amountEth ?? row.chargeEth ?? "—"}</td>
                  <td className="px-4 py-2">
                    {row.txHash ? (
                      <a
                        href={testnetTxUrl(row.txHash)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-indigo-600 hover:underline font-mono text-xs"
                      >
                        {String(row.txHash).slice(0, 10)}…
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
