import React, { useState } from "react";
import { Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import UserLiveWalletBar from "../components/UserLiveWalletBar.jsx";
import MarketplaceSidebar from "../components/MarketplaceSidebar.jsx";
import MegaNav from "../components/MegaNav.jsx";

/** Marketplace (developer) shell — use with /dashboard/* routes */
export default function MarketplaceLayout() {
  const { user } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className="antialiased min-h-screen bg-[#f9f9f9]">
      <MegaNav />
      <MarketplaceSidebar isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} />
      <main className={`pt-20 px-6 pb-16 min-h-[60vh] transition-all duration-300 ${isCollapsed ? "md:pl-16" : "md:pl-64"}`}>
        <Outlet />
      </main>
    </div>
  );
}
