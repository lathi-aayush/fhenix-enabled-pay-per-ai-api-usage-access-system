import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { api } from "../api/client.js";

export default function GatewayWallet() {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/api/gateway/status");
      setStatus(data);
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed to load gateway status");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (loading) {
    return <div className="p-8 text-sm text-slate-500">Loading gateway wallet…</div>;
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#031634]">Gateway Wallet</h1>
        <p className="text-sm text-slate-600 mt-1">
          API gateway prepaid balance — use FHE contract top-up for encrypted on-chain balance.
        </p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-3 text-sm">
        <p className="text-slate-600">{status?.message || "Gateway status unavailable."}</p>
        <dl className="grid gap-2">
          <div className="flex justify-between">
            <dt className="text-slate-500">Network</dt>
            <dd>{status?.network || "Sepolia"}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Enabled</dt>
            <dd>{status?.enabled ? "Yes" : "No"}</dd>
          </div>
        </dl>
      </div>

      <Link
        to="/dashboard/contract"
        className="inline-block bg-[#031634] text-white px-5 py-2.5 rounded-md text-sm font-medium hover:opacity-90"
      >
        Open FHE contract wallet →
      </Link>
    </div>
  );
}
