import React from "react";
import { Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import UserLiveWalletBar from "../components/UserLiveWalletBar.jsx";
import MarketplaceSidebar from "../components/MarketplaceSidebar.jsx";
import MegaNav from "../components/MegaNav.jsx";

/** Marketplace (developer) shell — use with /dashboard/* routes */
export default function MarketplaceLayout() {
  const { user } = useAuth();
  return (
    <div className="antialiased min-h-screen bg-[#f9f9f9]">
      <MegaNav />
      <MarketplaceSidebar />
      <main className="md:pl-64 pt-20 px-6 pb-16 min-h-[60vh]">
        <Outlet />
      </main>
    </div>
  );
}
