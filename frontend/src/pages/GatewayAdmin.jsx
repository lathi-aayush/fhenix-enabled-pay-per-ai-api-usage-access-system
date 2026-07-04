import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { api } from "../api/client.js";

export default function GatewayAdmin() {
  const [dash, setDash] = useState(null);
  const [audit, setAudit] = useState(null);

  useEffect(() => {
    Promise.all([
      api.get("/api/gateway/admin/dashboard"),
      api.get("/api/gateway/audit/health"),
    ])
      .then(([d, a]) => {
        setDash(d.data);
        setAudit(a.data);
      })
      .catch((err) => toast.error(err?.response?.data?.error || "Admin access denied"));
  }, []);

  if (!dash) return <div className="p-8 text-slate-500">Loading admin control center…</div>;

  const s = dash.summary || {};

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <h1 className="text-2xl font-bold text-slate-900">Gateway Admin Control Center</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Active users" value={s.activeUsers} />
        <Metric label="Active APIs" value={s.activeApis} />
        <Metric label="Subscriptions" value={s.activeSubscriptions} />
        <Metric label="Calls today" value={s.callsToday} />
        <Metric label="Spend today" value={`${(s.spendTodayEth ?? 0).toFixed(4)} ETH`} />
        <Metric label="Deposits today" value={s.depositsToday} />
        <Metric label="Failed today" value={s.failedRequestsToday} />
        <Metric label="Platform fees (total)" value={`${(s.platformFeeEthTotal ?? 0).toFixed(4)} ETH`} />
      </div>

      <section className="rounded-xl border bg-white p-6">
        <h2 className="font-semibold mb-3">API health</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-slate-500 border-b text-left">
              <th className="py-2">API</th>
              <th className="py-2">Calls</th>
              <th className="py-2">Errors</th>
              <th className="py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {(dash.apiHealth ?? []).map((h) => (
              <tr key={h.apiId} className="border-b border-slate-100">
                <td className="py-2">{h.name}</td>
                <td className="py-2">{h.callsToday}</td>
                <td className="py-2">{h.errorsToday}</td>
                <td className="py-2">{h.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="rounded-xl border bg-white p-6">
        <h2 className="font-semibold mb-3">Audit health</h2>
        <p className="text-sm mb-2">Overall: {audit?.ok ? "PASS" : "ATTENTION"}</p>
        <ul className="text-xs text-slate-600 space-y-1">
          {(audit?.checks ?? []).map((c) => (
            <li key={c.name}>
              {c.ok ? "✓" : "✗"} {c.name}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-xl font-bold">{value ?? 0}</p>
    </div>
  );
}
