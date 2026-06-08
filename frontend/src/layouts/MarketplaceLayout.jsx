import React from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../context/AuthContext.jsx";
import { usePeraLogin } from "../context/PeraLoginContext.jsx";
import logo from "../assets/logo.png";
import ProfileDropdown from "../components/ProfileDropdown.jsx";
import UserLiveWalletBar from "../components/UserLiveWalletBar.jsx";
import MarketplaceSidebar, { sectionTitle, sidebarActiveId } from "../components/MarketplaceSidebar.jsx";

/** Marketplace shell — public /marketplace/* browse and /dashboard/* account routes */
export default function MarketplaceLayout() {
  const { user, isAuthenticated } = useAuth();
  const { connectWithPera } = usePeraLogin();
  const { pathname } = useLocation();
  const active = sidebarActiveId(pathname);
  const sectionLabel = sectionTitle(pathname, active);

  return (
    <div className="antialiased min-h-screen bg-[#f9f9f9]">
      <header className="fixed top-0 left-0 right-0 h-14 bg-white border-b border-slate-100 z-50 flex items-center justify-between px-4 md:pl-[252px]">
        <div className="flex items-center gap-3 min-w-0">
          <Link to="/" className="flex items-center gap-2 shrink-0" title="Sentinal Home">
            <img src={logo} alt="Sentinal" className="w-8 h-8 rounded-lg object-contain border border-slate-200" />
            <span className="font-headline font-semibold text-primary text-sm hidden sm:inline">Sentinal</span>
          </Link>
          <span className="text-slate-300 hidden sm:inline">/</span>
          <span className="text-sm font-semibold text-slate-700 truncate">{sectionLabel}</span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {user?.walletAddress && <UserLiveWalletBar walletAddress={user.walletAddress} variant="pills" />}
          {isAuthenticated ? (
            <ProfileDropdown />
          ) : (
            <button
              type="button"
              onClick={() => connectWithPera({ redirect: pathname })}
              className="flex items-center gap-2 px-4 py-1.5 bg-[#031634] text-white rounded-full text-sm font-semibold hover:bg-[#0a2855] transition-all cursor-pointer"
            >
              Connect Wallet
            </button>
          )}
        </div>
      </header>

      <MarketplaceSidebar />

      <main className="md:ml-[240px] pt-14 min-h-screen">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="px-4 sm:px-6 pb-16 max-w-6xl mx-auto"
        >
          <Outlet />
        </motion.div>
      </main>
    </div>
  );
}
