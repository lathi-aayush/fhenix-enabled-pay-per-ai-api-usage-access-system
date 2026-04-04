import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { api } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { chargeForTokens } from "../utils/tokenPricing.js";
import { useTokenEstimate } from "../hooks/useTokenEstimate.js";

const PROVIDERS = [
  { id: "groq", label: "Groq (OpenAI-compatible)" },
  { id: "openai", label: "OpenAI" },
  { id: "anthropic", label: "Anthropic" },
  { id: "together", label: "Together AI" },
];

const EXAMPLE_TOKEN_LEVELS = [100, 500, 2000];

export default function CreateService() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [pricePerThousandTokens, setPricePerThousandTokens] = useState("");
  const [minimumChargeAlgo, setMinimumChargeAlgo] = useState("0.001");
  const [aiProvider, setAiProvider] = useState("groq");
  const [providerApiKey, setProviderApiKey] = useState("");
  const [modelName, setModelName] = useState("llama-3.3-70b-versatile");
  const [submitting, setSubmitting] = useState(false);

  const [providerCostPerThousand, setProviderCostPerThousand] = useState("");
  const [profitMarginPercent, setProfitMarginPercent] = useState("30");
  const [samplePromptText, setSamplePromptText] = useState("");

  const pptNum = parseFloat(pricePerThousandTokens);
  const minNum = parseFloat(minimumChargeAlgo);
  const { estimatedAlgo, minApplies } = useTokenEstimate(
    samplePromptText,
    Number.isFinite(pptNum) ? pptNum : 0,
    Number.isFinite(minNum) ? minNum : 0
  );

  const suggestedPrice = useMemo(() => {
    const cost = parseFloat(providerCostPerThousand);
    const margin = parseFloat(profitMarginPercent);
    if (!Number.isFinite(cost) || cost < 0 || !Number.isFinite(margin)) return null;
    return Math.round(cost * (1 + margin / 100) * 1e6) / 1e6;
  }, [providerCostPerThousand, profitMarginPercent]);

  const previews = useMemo(() => {
    if (!Number.isFinite(pptNum) || !Number.isFinite(minNum)) return [];
    return EXAMPLE_TOKEN_LEVELS.map((tokens) => ({
      tokens,
      algo: chargeForTokens(tokens, pptNum, minNum),
    }));
  }, [pptNum, minNum]);

  function applySuggestedPrice() {
    if (suggestedPrice == null) return;
    setPricePerThousandTokens(String(suggestedPrice));
    toast.success("Applied suggested price per 1k tokens");
  }

  async function onSubmit(e) {
    e.preventDefault();
    const ppt = parseFloat(pricePerThousandTokens);
    const minC = parseFloat(minimumChargeAlgo);
    if (!title.trim() || !Number.isFinite(ppt) || ppt < 0) {
      toast.error("Valid title and price per thousand tokens required");
      return;
    }
    if (!Number.isFinite(minC) || minC < 0.000001) {
      toast.error("Minimum charge must be at least 0.000001 ALGO");
      return;
    }
    if (!providerApiKey.trim() || !modelName.trim()) {
      toast.error("Provider API key and model name are required");
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/api/services", {
        title: title.trim(),
        description,
        pricePerThousandTokens: ppt,
        minimumChargeAlgo: minC,
        aiProvider,
        providerApiKey: providerApiKey.trim(),
        modelName: modelName.trim(),
      });
      toast.success("Service published — your key is encrypted on the server");
      navigate("/creator");
    } catch (err) {
      const d = err?.response?.data;
      const msg =
        (Array.isArray(d?.errors) && d.errors.map((x) => x.msg).join(" ")) ||
        d?.error ||
        "Failed to create";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface font-body">
      <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-surface-container-high px-6 h-16 flex items-center justify-between">
        <Link to="/creator" className="text-sm text-secondary">
          ← Dashboard
        </Link>
        <span className="font-mono text-xs truncate max-w-[200px]">{user?.walletAddress}</span>
        <button type="button" onClick={() => logout()} className="text-sm text-on-surface-variant">
          Sign out
        </button>
      </header>

      <main className="pt-24 px-6 max-w-xl mx-auto pb-16">
        <h1 className="font-headline text-2xl font-semibold text-primary">New AI endpoint</h1>
        <p className="text-sm text-on-surface-variant mt-2 mb-8">
          Your provider key is encrypted and never shown again. Users pay per token consumed (plus a minimum per
          call).
        </p>

        <form onSubmit={onSubmit} className="space-y-6 bg-white border border-surface-variant p-8 rounded-md">
          <div>
            <label className="block text-sm font-medium text-primary mb-1">Title</label>
            <input
              className="w-full border border-outline-variant rounded-md px-3 py-2 text-sm"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-primary mb-1">Description</label>
            <textarea
              className="w-full border border-outline-variant rounded-md px-3 py-2 text-sm min-h-[100px]"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-primary mb-1">AI provider</label>
            <select
              className="w-full border border-outline-variant rounded-md px-3 py-2 text-sm"
              value={aiProvider}
              onChange={(e) => setAiProvider(e.target.value)}
            >
              {PROVIDERS.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-primary mb-1">
              Provider API key (encrypted at rest)
            </label>
            <input
              type="password"
              autoComplete="off"
              className="w-full border border-outline-variant rounded-md px-3 py-2 text-sm font-mono"
              value={providerApiKey}
              onChange={(e) => setProviderApiKey(e.target.value)}
              placeholder="Never shown again after save"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-primary mb-1">Model name</label>
            <input
              className="w-full border border-outline-variant rounded-md px-3 py-2 text-sm font-mono"
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              placeholder="e.g. llama-3.3-70b-versatile, gpt-4o, claude-3-5-sonnet-20241022"
              required
            />
          </div>

          <div className="border border-dashed border-outline-variant rounded-md p-4 space-y-3 bg-surface-container-low/30">
            <p className="text-sm font-medium text-primary">Profit helper</p>
            <p className="text-xs text-on-surface-variant">
              Enter what you pay your AI provider per 1k tokens and your target margin. We suggest a list price you can
              paste below.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-on-surface-variant mb-1">Your cost / 1k tokens (ALGO)</label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  className="w-full border border-outline-variant rounded-md px-2 py-1.5 text-sm font-mono"
                  value={providerCostPerThousand}
                  onChange={(e) => setProviderCostPerThousand(e.target.value)}
                  placeholder="0.005"
                />
              </div>
              <div>
                <label className="block text-xs text-on-surface-variant mb-1">Profit margin (%)</label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  className="w-full border border-outline-variant rounded-md px-2 py-1.5 text-sm font-mono"
                  value={profitMarginPercent}
                  onChange={(e) => setProfitMarginPercent(e.target.value)}
                  placeholder="30"
                />
              </div>
            </div>
            {suggestedPrice != null && (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-on-surface-variant">Suggested price / 1k tokens:</span>
                <span className="font-mono font-semibold text-secondary">{suggestedPrice.toFixed(6)} ALGO</span>
                <button
                  type="button"
                  onClick={applySuggestedPrice}
                  className="text-xs px-2 py-1 rounded-md border border-secondary text-secondary"
                >
                  Apply
                </button>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-primary mb-1">Price per thousand tokens (ALGO)</label>
            <input
              type="number"
              step="any"
              min="0"
              className="w-full border border-outline-variant rounded-md px-3 py-2 text-sm font-mono"
              value={pricePerThousandTokens}
              onChange={(e) => setPricePerThousandTokens(e.target.value)}
              placeholder="e.g. 0.01 ALGO per 1,000 tokens"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-primary mb-1">Minimum charge per call (ALGO)</label>
            <input
              type="number"
              step="any"
              min="0.000001"
              className="w-full border border-outline-variant rounded-md px-3 py-2 text-sm font-mono"
              value={minimumChargeAlgo}
              onChange={(e) => setMinimumChargeAlgo(e.target.value)}
              placeholder="e.g. 0.001 ALGO floor per paid call"
              required
            />
            <p className="text-xs text-on-surface-variant mt-1">
              Covers tiny prompts so fees don&apos;t exceed the payment.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-primary mb-1">Sample user prompt (live cost preview)</label>
            <textarea
              className="w-full border border-outline-variant rounded-md px-3 py-2 text-sm min-h-[88px]"
              value={samplePromptText}
              onChange={(e) => setSamplePromptText(e.target.value)}
              placeholder="Type text as if a user were calling your API — estimate updates as you type."
            />
            <p className="text-xs text-on-surface-variant mt-2">
              Estimated cost{" "}
              <span className="font-mono font-semibold text-secondary">{estimatedAlgo.toFixed(6)} ALGO</span>
              {minApplies && (
                <span className="block text-amber-800 mt-1">Minimum charge applies.</span>
              )}
            </p>
          </div>

          {previews.length > 0 && (
            <div className="rounded-md border border-outline-variant bg-surface-container-low/40 p-4">
              <p className="text-sm font-medium text-primary mb-2">Example charges at your rate</p>
              <ul className="text-xs text-on-surface-variant space-y-1 font-mono">
                {previews.map((p) => (
                  <li key={p.tokens}>
                    ~{p.tokens} tokens → max(({p.tokens}/1000)×rate, min) ≈{" "}
                    <span className="text-secondary font-semibold">{p.algo.toFixed(6)} ALGO</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="bg-primary text-on-primary px-6 py-2.5 rounded-md text-sm font-medium disabled:opacity-50"
          >
            {submitting ? "Saving…" : "Publish service"}
          </button>
        </form>
      </main>
    </div>
  );
}
