import React from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/client.js";
import { useAuth } from "../../context/AuthContext.jsx";
import GuestConnectBanner from "../../components/GuestConnectBanner.jsx";

function statusBadge(status) {
  const map = {
    published: "bg-emerald-100 text-emerald-800",
    publishing: "bg-amber-100 text-amber-800",
    failed: "bg-rose-100 text-rose-800",
    draft: "bg-slate-100 text-slate-600",
  };
  return map[status] || map.draft;
}

export default function Published() {
  const { user, isAuthenticated } = useAuth();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["studio-published"],
    queryFn: async () => (await api.get("/api/studio/published")).data,
    enabled: Boolean(user),
  });
  const posts = data?.posts ?? [];

  return (
    <div className="pt-6 max-w-4xl">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-headline text-2xl font-semibold text-primary mb-2">Published</h1>
          <p className="text-sm text-on-surface-variant">
            Posts live on Sentinal Studio and connected platforms.
          </p>
          {!isAuthenticated && (
            <GuestConnectBanner message="Connect Pera Wallet to view published posts." className="mt-4" />
          )}
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          className="text-xs font-semibold px-3 py-2 border border-surface-variant rounded-md hover:bg-slate-50"
        >
          Refresh
        </button>
      </header>

      {isLoading && <p className="text-sm animate-pulse">Loading…</p>}

      <ul className="space-y-3">
        {posts.map((p) => (
          <li
            key={p._id}
            className="bg-white border border-surface-variant rounded-xl px-4 py-4 text-sm shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="font-semibold text-primary text-base">{p.title || "Untitled"}</div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {p.wordCount || 0} words · {p.readingTime || 1} min read
                  {p.projectId?.title ? ` · ${p.projectId.title}` : ""}
                </p>
              </div>
              <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${statusBadge(p.status)}`}>
                {p.status}
              </span>
            </div>

            {(p.publishedPlatforms || []).length > 0 ? (
              <div className="mt-3 space-y-1">
                {p.publishedPlatforms.map((pp, i) => (
                  <div key={i} className="text-xs text-on-surface-variant flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-600 min-w-[100px]">
                      {pp.platform === "sentinel-studio" ? "Sentinal Studio" : pp.platform}
                    </span>
                    {pp.platform === "sentinel-studio" ? (
                      <Link
                        to={`/studio/blogging-agent?post=${p._id}`}
                        className="text-secondary font-semibold hover:underline"
                      >
                        Edit post →
                      </Link>
                    ) : pp.url && !pp.url.includes(".example") ? (
                      <a
                        href={pp.url}
                        className="text-secondary hover:underline break-all"
                        target="_blank"
                        rel="noreferrer"
                      >
                        {pp.url}
                      </a>
                    ) : (
                      <span>Pending…</span>
                    )}
                    {pp.publishedAt && (
                      <span className="text-slate-400">
                        {new Date(pp.publishedAt).toLocaleString()}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 mt-2">No platform links recorded yet.</p>
            )}

            {p.publishError && (
              <p className="text-xs text-rose-700 mt-2 bg-rose-50 border border-rose-100 rounded px-2 py-1.5">
                {p.publishError}
              </p>
            )}

            <div className="mt-3 flex gap-2">
              <Link
                to={`/studio/blogging-agent?post=${p._id}`}
                className="text-xs font-semibold text-[#031634] hover:underline"
              >
                Open in editor
              </Link>
            </div>
          </li>
        ))}
      </ul>

      {!isLoading && posts.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center">
          <p className="text-sm text-slate-600">No published posts yet.</p>
          <p className="text-xs text-slate-500 mt-2">
            Run a workflow with a Blog Agent node (Publish to Studio), or use{" "}
            <strong>Publish to Studio</strong> in Blogging Agent.
          </p>
          <Link
            to="/studio/blogging-agent"
            className="inline-block mt-4 text-sm font-semibold text-secondary hover:underline"
          >
            Go to Blogging Agent →
          </Link>
        </div>
      )}

    </div>
  );
}
