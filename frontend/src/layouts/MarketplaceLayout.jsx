import React from "react";
import logo from "../assets/logo.png";
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
          <Link to="/" className="flex items-center gap-2 text-xl font-bold tracking-tight font-headline text-slate-900 shrink-0">
            <img src={logo} alt="Sentinel Logo" className="w-8 h-8 rounded-lg object-contain bg-white p-0.5 border border-slate-200" />
            <span>Sentinal</span>
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
