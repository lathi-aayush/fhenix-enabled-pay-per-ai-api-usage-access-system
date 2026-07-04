import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client.js";

export default function GatewayMarketplace() {
  const [data, setData] = useState(null);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [results, setResults] = useState(null);

  const load = useCallback(async () => {
    const { data: home } = await api.get("/api/gateway/marketplace");
    setData(home);
  }, []);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  async function search(e) {
    e?.preventDefault();
    const { data: found } = await api.get("/api/gateway/marketplace/search", {
      params: { q, category: category || undefined },
    });
    setResults(found);
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <h1 className="text-2xl font-bold text-slate-900">API Marketplace</h1>
      <p className="text-slate-600 text-sm">Discover proxied APIs with transparent pricing.</p>

      <form onSubmit={search} className="flex flex-wrap gap-2">
        <input
          className="flex-1 min-w-[200px] border rounded-lg px-3 py-2 text-sm"
          placeholder="Search APIsâ€¦"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className="border rounded-lg px-3 py-2 text-sm"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">All categories</option>
          {(data?.categories ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
        <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm">
          Search
        </button>
      </form>

      {results && <ApiGrid title="Search results" apis={results} />}
      <ApiGrid title="Trending" apis={data?.trending} badge="Trending" />
      <ApiGrid title="Popular" apis={data?.popular} badge="Popular" />
      <ApiGrid title="All APIs" apis={data?.featured} />
    </div>
  );
}

function ApiGrid({ title, apis, badge }) {
  if (!apis?.length) return null;
  return (
    <section>
      <h2 className="font-semibold text-slate-900 mb-3">{title}</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {apis.map((a) => (
          <article key={a.id} className="border rounded-xl p-5 bg-white shadow-sm">
            <div className="flex justify-between items-start">
              <h3 className="font-medium text-slate-900">{a.name}</h3>
              {(a.badge || badge) && (
                <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded">
                  {a.badge || badge}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1 line-clamp-2">{a.description}</p>
            <p className="text-sm text-indigo-600 mt-3">
              {a.priceEth} ETH Â· {a.pricingModel}
            </p>
            <p className="text-xs text-slate-400 mt-1 font-mono">{a.proxyUrl}</p>
            <p className="text-xs text-slate-400 capitalize">{a.category}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
