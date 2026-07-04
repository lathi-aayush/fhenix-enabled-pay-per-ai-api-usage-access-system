import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { api } from "../api/client.js";
import UsageTrendChart from "../components/gateway/UsageTrendChart.jsx";

export default function GatewayDeveloper() {
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState(null);
  const [payoutAmount, setPayoutAmount] = useState("");
  const [migrationSecret, setMigrationSecret] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/api/gateway/developer/dashboard");
      setDashboard(data);
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed to load developer gateway");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function runMigration() {
    try {
      const { data } = await api.post(
        "/api/gateway/migrate/services",
        { onlyActive: true },
        migrationSecret ? { headers: { "x-migration-secret": migrationSecret } } : {}
      );
      toast.success(`Synced ${data.synced ?? data.updated ?? 0} services`);
      refresh();
    } catch (err) {
      toast.error(err?.response?.data?.error || "Migration failed");
    }
  }

  async function requestPayout() {
    const amountEth = parseFloat(payoutAmount);
    if (isNaN(amountEth) || amountEth <= 0) return toast.error("Enter a valid ETH amount");
    try {
      const { data } = await api.post("/api/gateway/developer/payout", { amountEth });
      toast.success(`Payout submitted: ${data.txId || "queued"}`);
      setPayoutAmount("");
      refresh();
    } catch (err) {
      toast.error(err?.response?.data?.error || "Payout failed");
    }
  }

  async function saveDevAlert() {
    try {
      await api.post("/api/gateway/alerts", {
        type: "api_outage",
        thresholdCents: 0,
        notifyEmail: true,
      });
      toast.success("API outage alerts enabled");
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed");
    }
  }

  if (loading) return <div className="p-8 text-slate-500">Loading developer studioâ€¦</div>;

  const e = dashboard?.earnings || {};
  const rev = dashboard?.period?.revenueEth || {};

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">API Gateway â€” Developer Studio</h1>
        <p className="text-slate-600 text-sm mt-1">Revenue, API health, payouts, and migration tools.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card label="Available earnings" value={`${(e.availableEth ?? 0).toFixed(4)} ETH`} />
        <Card
          label="Revenue today / week / month"
          value={`${(rev.today ?? 0).toFixed(4)} / ${(rev.week ?? 0).toFixed(4)} / ${(rev.month ?? 0).toFixed(4)} ETH`}
        />
        <Card label="Active consumers" value={dashboard?.activeConsumers ?? 0} />
        <Card label="Pending payout" value={`${(e.pendingEth ?? 0).toFixed(4)} ETH`} />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="font-semibold text-slate-900 mb-4">Revenue trend</h2>
        <UsageTrendChart data={dashboard?.trend} valueKey="revenueEth" label="Revenue (ETH)" />
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <h2 className="font-semibold text-slate-900">Your proxied APIs</h2>
        {(dashboard?.apis ?? []).length === 0 ? (
          <p className="text-sm text-slate-500">No ProxyApi records â€” run migration from Services.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b">
                  <th className="py-2">API</th>
                  <th className="py-2">Calls</th>
                  <th className="py-2">Revenue</th>
                  <th className="py-2">Latency</th>
                  <th className="py-2">Health</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.apis.map((a) => (
                  <tr key={a._id} className="border-b border-slate-100">
                    <td className="py-2">
                      <span className="font-medium">{a.name}</span>
                      <br />
                      <code className="text-xs text-slate-500">{a.proxySlug}</code>
                    </td>
                    <td className="py-2">{a.stats?.calls ?? 0}</td>
                    <td className="py-2">{(a.stats?.revenueEth ?? 0).toFixed(4)} ETH</td>
                    <td className="py-2">{Math.round(a.stats?.avgLatency ?? 0)}ms</td>
                    <td className="py-2">
                      <span
                        className={
                          a.stats?.health === "degraded"
                            ? "text-amber-600"
                            : "text-emerald-600"
                        }
                      >
                        {a.stats?.health ?? "â€”"} ({a.stats?.errorRatePct ?? 0}% err)
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-3">
          <h2 className="font-semibold text-slate-900">Request payout</h2>
          <p className="text-xs text-slate-500">Min: {(e.minPayoutEth ?? 15).toFixed(4)} ETH</p>
          <div className="flex gap-2">
            <input
              className="border rounded-lg px-3 py-2 text-sm flex-1"
              placeholder="Amount (ETH)"
              value={payoutAmount}
              onChange={(ev) => setPayoutAmount(ev.target.value)}
            />
            <button
              type="button"
              onClick={requestPayout}
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm"
            >
              Withdraw
            </button>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-3">
          <h2 className="font-semibold text-slate-900">Monitoring</h2>
          <button
            type="button"
            onClick={saveDevAlert}
            className="text-sm text-indigo-600 hover:underline"
          >
            Enable API outage alerts
          </button>
          <h3 className="text-sm font-medium text-slate-700 mt-4">Recent errors</h3>
          {(dashboard?.recentErrors ?? []).length === 0 ? (
            <p className="text-xs text-slate-500">None</p>
          ) : (
            <ul className="text-xs text-slate-600 space-y-1 max-h-32 overflow-y-auto">
              {dashboard.recentErrors.map((r) => (
                <li key={r.requestId}>
                  {r.apiName}: HTTP {r.httpStatus} â€” {new Date(r.timestamp).toLocaleString()}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-3">
        <h2 className="font-semibold text-slate-900">Migrate Services â†’ ProxyApi</h2>
        <input
          className="border rounded-lg px-3 py-2 text-sm w-full max-w-md"
          placeholder="GATEWAY_MIGRATION_SECRET (optional)"
          value={migrationSecret}
          onChange={(ev) => setMigrationSecret(ev.target.value)}
        />
        <button
          type="button"
          onClick={runMigration}
          className="px-4 py-2 rounded-lg bg-slate-800 text-white text-sm"
        >
          Run migration
        </button>
      </section>
    </div>
  );
}

function Card({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs uppercase text-slate-500">{label}</p>
      <p className="text-xl font-bold text-slate-900">{value}</p>
    </div>
  );
}
