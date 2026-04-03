import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { api } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";

const PROVIDERS = [
  { id: "groq", label: "Groq (OpenAI-compatible)" },
  { id: "openai", label: "OpenAI" },
  { id: "anthropic", label: "Anthropic" },
];

export default function CreateService() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [aiProvider, setAiProvider] = useState("groq");
  const [providerApiKey, setProviderApiKey] = useState("");
  const [modelName, setModelName] = useState("llama-3.3-70b-versatile");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    const p = parseFloat(price);
    if (!title.trim() || Number.isNaN(p) || p < 0) {
      toast.error("Valid title and price required");
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
        price: p,
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
          Your provider key is encrypted and never shown again. Set the per-request price in ALGO for users who call through Sentinel.
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
              Provider API key (Groq / OpenAI / Anthropic)
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
          <div>
            <label className="block text-sm font-medium text-primary mb-1">Price per request (ALGO)</label>
            <input
              type="number"
              step="any"
              min="0"
              className="w-full border border-outline-variant rounded-md px-3 py-2 text-sm font-mono"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              required
            />
          </div>
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
