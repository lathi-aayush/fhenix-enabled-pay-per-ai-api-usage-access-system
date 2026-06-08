import React from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/client.js";
import { useAuth } from "../../context/AuthContext.jsx";
import GuestConnectBanner from "../../components/GuestConnectBanner.jsx";

export default function Drafts() {
  const { user, isAuthenticated } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["studio-drafts"],
    queryFn: async () => (await api.get("/api/studio/drafts")).data,
    enabled: Boolean(user),
  });
  const posts = data?.posts ?? [];

  return (
    <div className="pt-6 max-w-4xl">
      <h1 className="font-headline text-2xl font-semibold text-primary mb-2">Drafts</h1>
      <p className="text-sm text-on-surface-variant mb-6">In-progress posts not yet published.</p>
      {!isAuthenticated && <GuestConnectBanner message="Connect Pera Wallet to view your drafts." className="mb-6" />}
      {isLoading && <p className="text-sm animate-pulse">Loading…</p>}
      <ul className="space-y-2">
        {posts.map((p) => (
          <li key={p._id} className="bg-white border border-surface-variant rounded-md px-4 py-3 flex flex-wrap justify-between gap-2">
            <div>
              <div className="font-semibold text-primary text-sm">{p.title}</div>
              <div className="text-xs text-on-surface-variant">
                {p.projectId?.title || "Project"} · updated {p.updatedAt ? new Date(p.updatedAt).toLocaleString() : ""}
              </div>
            </div>
            <Link to="/studio/blogging-agent" state={{ postId: p._id }} className="text-xs text-secondary self-center">
              Edit
            </Link>
          </li>
        ))}
      </ul>
      {!isLoading && posts.length === 0 && <p className="text-sm text-on-surface-variant">No drafts.</p>}
    </div>
  );
}
