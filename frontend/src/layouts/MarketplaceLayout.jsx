import React from "react";
import { Outlet, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import UserLiveWalletBar from "../components/UserLiveWalletBar.jsx";
import ProfileDropdown from "../components/ProfileDropdown.jsx";
import MarketplaceSidebar from "../components/MarketplaceSidebar.jsx";

/** Marketplace (developer) shell — use with /dashboard/* routes */
export default function MarketplaceLayout() {
  const { user } = useAuth();
  return (
    <div className="antialiased min-h-screen bg-[#f9f9f9]">
      <header className="bg-white fixed top-0 z-50 w-full border-b border-slate-100 h-16 px-4 sm:px-6 flex justify-between items-center font-body text-sm gap-2">
        <div className="flex items-center gap-4 min-w-0">
          <Link to="/" className="text-xl font-bold tracking-tight font-headline text-slate-900 shrink-0">
            Sentinal
          </Link>
        </div>
        <div className="flex items-center gap-4">
          {user?.walletAddress && <UserLiveWalletBar walletAddress={user.walletAddress} />}
          <ProfileDropdown />
        </div>
      </header>
      <MarketplaceSidebar />
      <main className="md:pl-64 pt-24 px-6 pb-16 min-h-[60vh]">
        <Outlet />
      </main>
    </div>
  );
}
