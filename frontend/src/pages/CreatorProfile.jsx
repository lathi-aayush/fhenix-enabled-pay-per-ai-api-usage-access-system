import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { api } from "../api/client.js";
import MarketplaceCard, { shortenWallet } from "../components/MarketplaceCard.jsx";

export default function CreatorProfile() {
  const { walletAddress } = useParams();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get(
          `/api/creator/public/${encodeURIComponent(walletAddress)}`
        );
        if (!cancelled) setProfile(data);
      } catch (e) {
        toast.error(e?.response?.data?.error || "Creator not found");
        if (!cancelled) setProfile(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [walletAddress]);

  if (loading) {
    return <p className="text-on-surface-variant">Loading creator profile…</p>;
  }

  if (!profile) {
    return (
      <div className="pt-4 pb-8 w-full">
        <p className="text-on-surface-variant mb-4">Creator profile not found.</p>
        <Link to="/marketplace/browse" className="text-sm text-secondary hover:underline">
          ← Back to Marketplace
        </Link>
      </div>
    );
  }

  const displayName = profile.displayName || shortenWallet(profile.walletAddress);

  return (
    <div className="pt-4 pb-8 w-full">
      <Link to="/marketplace/browse" className="text-sm text-secondary hover:underline">
        ← Marketplace
      </Link>

      <header className="mt-6 bg-white border border-surface-variant rounded-md p-6 editorial-shadow">
        <div className="flex flex-col sm:flex-row gap-5 items-start">
          {profile.photoURL ? (
            <img
              src={profile.photoURL}
              alt=""
              className="w-16 h-16 rounded-full object-cover border border-surface-variant"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center font-headline text-xl font-semibold">
              {displayName.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="font-headline text-2xl font-semibold text-primary">{displayName}</h1>
            <p className="text-xs font-mono text-on-surface-variant mt-1 break-all">
              {profile.walletAddress}
            </p>
            <div className="mt-4 flex flex-wrap gap-4 text-sm">
              <div>
                <p className="text-xs uppercase tracking-wide text-on-surface-variant">Total calls</p>
                <p className="font-semibold text-primary">{profile.totalUses ?? 0}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-on-surface-variant">Revenue (ALGO)</p>
                <p className="font-semibold text-primary font-mono">
                  {Number(profile.totalRevenue || 0).toFixed(4)}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-on-surface-variant">Published APIs</p>
                <p className="font-semibold text-primary">{profile.serviceCount ?? 0}</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <section className="mt-8">
        <h2 className="font-semibold text-primary mb-4">Published services</h2>
        {profile.services?.length ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {profile.services.map((s) => (
              <MarketplaceCard key={s._id} s={s} />
            ))}
          </div>
        ) : (
          <p className="text-on-surface-variant text-sm">This creator has no active listings yet.</p>
        )}
      </section>
    </div>
  );
}
