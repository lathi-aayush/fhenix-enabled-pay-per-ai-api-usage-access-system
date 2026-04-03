import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { api } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { getPublicApiBase } from "../utils/apiBase.js";

export default function ServiceDetail() {
  const { id } = useParams();
  const { user, logout } = useAuth();
  const [service, setService] = useState(null);
  const [loading, setLoading] = useState(true);
  const [balanceAlgo, setBalanceAlgo] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [apiKey, setApiKey] = useState(null);
  const [showKeyModal, setShowKeyModal] = useState(false);

  const apiBase = getPublicApiBase();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [{ data: svc }, { data: bal }] = await Promise.all([
          api.get(`/api/services/${id}`),
          api.get("/api/user/balance").catch(() => ({ data: {} })),
        ]);
        if (!cancelled) {
          setService(svc);
          setBalanceAlgo(bal?.balanceAlgo ?? 0);
        }
      } catch {
        toast.error("Service not found");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function generateKey() {
    if (!id || !/^[a-f0-9]{24}$/i.test(id)) {
      toast.error("Invalid service");
      return;
    }
    setGenerating(true);
    try {
      const { data } = await api.post("/api/access/generate", { serviceId: id });
      if (data?.key) {
        setApiKey(data.key);
        setShowKeyModal(true);
        toast.success("Proxy key ready");
      }
    } catch (e) {
      toast.error(e?.response?.data?.error || "Could not generate key");
    } finally {
      setGenerating(false);
    }
  }

  function handleCopyKey() {
    if (!apiKey) return;
    navigator.clipboard
      .writeText(apiKey)
      .then(() => toast.success("Copied"))
      .catch(() => toast.error("Copy failed"));
  }

  function handleCopySnippet() {
    if (!apiKey) return;
    const snippet = `curl -sS "${apiBase}/api/mock/v1/chat/completions" \\
  -H "Authorization: Bearer ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"messages":[{"role":"user","content":"Hello"}]}'`;
    navigator.clipboard.writeText(snippet).then(() => toast.success("cURL copied"));
  }

  if (loading) {
    return (
      <div className="min-h-screen pt-24 px-6 bg-surface flex items-center justify-center">
        <p className="text-on-surface-variant animate-pulse">Loading service…</p>
      </div>
    );
  }

  if (!service) {
    return (
      <div className="min-h-screen pt-24 px-6 bg-surface flex flex-col items-center justify-center gap-4">
        <p className="text-on-surface-variant">Service not found.</p>
        <Link to="/user/marketplace" className="text-sm text-secondary hover:underline">
          ← Back to Marketplace
        </Link>
      </div>
    );
  }

  const price = Number(service.price);
  const canProxy = service.providerConfigured === true;

  return (
    <div className="min-h-screen bg-surface font-body text-on-surface">
      <nav className="bg-white flex justify-between items-center h-16 px-6 w-full border-b border-slate-100 fixed top-0 z-40">
        <Link to="/user/marketplace" className="text-sm text-secondary hover:underline">
          ← Marketplace
        </Link>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-surface-container-low">
          <span className="material-symbols-outlined text-sm text-on-surface-variant">
            account_balance_wallet
          </span>
          <span className="text-sm font-mono truncate max-w-[160px]">{user?.walletAddress ?? "—"}</span>
        </div>
        <button type="button" onClick={() => logout()} className="text-sm text-on-surface-variant">
          Sign out
        </button>
      </nav>

      <div className="pt-24 px-6 max-w-3xl mx-auto pb-24">
        <h1 className="font-headline text-3xl font-semibold text-primary">{service.title}</h1>
        <p className="mt-4 text-on-surface-variant leading-relaxed">{service.description}</p>

        <div className="mt-6 flex flex-wrap gap-3 text-sm">
          <span className="px-3 py-1 rounded-md bg-white border border-surface-variant">
            Provider: <strong>{service.aiProvider ?? "—"}</strong>
          </span>
          <span className="px-3 py-1 rounded-md bg-white border border-surface-variant font-mono text-xs">
            {service.modelName || "—"}
          </span>
          <span className="px-3 py-1 rounded-md bg-white border border-surface-variant">
            Calls: <strong>{service.totalUses ?? 0}</strong>
          </span>
        </div>

        <div className="mt-8 p-6 bg-white border border-surface-variant rounded-md editorial-shadow space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-sm text-on-surface-variant">Price per API call</p>
              <p className="font-mono text-2xl font-semibold text-secondary mt-1">
                {price.toFixed(4)} ALGO
              </p>
            </div>
            <div>
              <p className="text-sm text-on-surface-variant">Your Sentinel balance</p>
              <p className="font-mono text-xl font-semibold text-primary mt-1">
                {(balanceAlgo ?? 0).toFixed(4)} ALGO
              </p>
              <Link to="/user/dashboard" className="text-xs text-secondary underline mt-1 inline-block">
                Top up balance
              </Link>
            </div>
          </div>

          {!canProxy && (
            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
              This listing is not wired to a live model yet. Ask the creator to republish with a provider key.
            </p>
          )}

          <div className="border-t border-surface-variant pt-6">
            <p className="text-sm text-on-surface-variant mb-3">
              Generate a unique <code className="font-mono text-xs">sk-sentinel-…</code> key. Each successful
              completion deducts <strong>{price.toFixed(4)} ALGO</strong> from your prepaid balance and forwards
              to the creator&apos;s configured model.
            </p>
            <button
              type="button"
              disabled={generating || !canProxy}
              onClick={generateKey}
              className="w-full sm:w-auto bg-primary text-white px-8 py-3 rounded-md font-medium hover:opacity-90 disabled:opacity-50"
            >
              {generating ? "Working…" : "Get proxy API key"}
            </button>
          </div>
        </div>
      </div>

      {showKeyModal && apiKey && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-surface-container-lowest max-w-lg w-full rounded-md border border-surface-variant p-8 shadow-xl max-h-[90vh] overflow-y-auto">
            <h2 className="font-headline text-xl font-semibold text-primary">Your proxy key</h2>
            <p className="text-sm text-on-surface-variant mt-2">
              Use it as <code className="font-mono text-xs">Authorization: Bearer …</code> or{" "}
              <code className="font-mono text-xs">x-api-key</code>. Store it safely.
            </p>
            <div className="mt-4 p-4 bg-surface-container rounded-md font-mono text-xs break-all border border-outline-variant select-all">
              {apiKey}
            </div>
            <p className="text-xs text-on-surface-variant mt-4">Endpoint</p>
            <div className="mt-1 p-3 bg-surface-container rounded-md font-mono text-[11px] break-all border border-outline-variant">
              {apiBase}/api/mock/v1/chat/completions
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleCopyKey}
                className="bg-secondary text-on-secondary px-4 py-2 rounded-md text-sm"
              >
                Copy key
              </button>
              <button
                type="button"
                onClick={handleCopySnippet}
                className="border border-outline-variant px-4 py-2 rounded-md text-sm"
              >
                Copy cURL
              </button>
              <button
                type="button"
                onClick={() => setShowKeyModal(false)}
                className="text-sm text-on-surface-variant underline"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
