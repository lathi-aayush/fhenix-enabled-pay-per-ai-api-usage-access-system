import React, { useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import logo from "../assets/logo.png";
import ProfileDropdown from "./ProfileDropdown.jsx";
import UserLiveWalletBar from "./UserLiveWalletBar.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { goToHomeSection } from "../utils/scrollToSection.js";

/* ─── Dropdown data ─────────────────────────────────────────────── */
const menus = {
  Product: {
    sections: [
      {
        title: "Platform",
        items: [
          { icon: "storefront",             label: "API Marketplace",    sub: "Browse & buy AI APIs",          path: "/dashboard/browse",  auth: true  },
          { icon: "movie_creation",         label: "AI Studio",          sub: "Blogging & publishing agents",  path: "/studio",            auth: true  },
          { icon: "account_balance_wallet", label: "Pera Wallet",        sub: "Algorand micro-payments",       path: "/docs/how-it-works" },
        ],
      },
      {
        title: "Protocol",
        items: [
          { icon: "integration_instructions", label: "x402 Payments",    sub: "Keyless agent transactions",   path: "/docs/x402",    auth: true,  badge: "NEW" },
          { icon: "monitoring",               label: "Analytics",         sub: "Usage & revenue dashboards",  path: "/studio/analytics",  auth: true  },
          { icon: "smart_toy",                label: "Agentic Workflows", sub: "n8n & LangChain integration", path: "/docs/x402",    auth: true  },
        ],
      },
    ],
    cta: { label: "Explore Marketplace →", path: "/dashboard/browse", auth: true },
  },
  "Use Cases": {
    sections: [
      {
        title: "For Developers",
        items: [
          { icon: "code",      label: "Build AI Apps",       sub: "Integrate AI in minutes",        path: "/dashboard/browse",  auth: true },
          { icon: "api",       label: "REST & x402 APIs",    sub: "Keyless M2M payments",            path: "/docs/x402",    auth: true },
          { icon: "hub",       label: "Multi-Agent Systems", sub: "Orchestrate autonomous agents",   path: "/docs/x402",    auth: true },
        ],
      },
      {
        title: "For Creators",
        items: [
          { icon: "edit_note", label: "Blogging Agent",      sub: "Auto-publish articles",           path: "/studio/blogging-agent",  auth: true },
          { icon: "videocam",  label: "Video Editor",        sub: "AI-powered video production",     path: "/studio/video-editor",    auth: true },
          { icon: "bar_chart", label: "Earnings Dashboard",  sub: "Track API revenue on-chain",      path: "/creator",               auth: true, creatorOnly: true },
        ],
      },
    ],
    cta: { label: "Get Started as Creator →", path: "/creator", auth: true },
  },
  Resources: {
    sections: [
      {
        title: "Docs & Guides",
        items: [
          { icon: "menu_book", label: "x402 Protocol Docs",  sub: "Full API reference",              path: "/docs/x402",    auth: true },
          { icon: "science",   label: "Live Playground",     sub: "Test live x402 transactions",     path: "/docs/x402",    auth: true },
          { icon: "terminal",  label: "Code Examples",       sub: "cURL, JS, Python snippets",       path: "/docs/x402",    auth: true },
        ],
      },
    ],
    cta: { label: "Open x402 Playground →", path: "/docs/x402", auth: true },
  },
};

/* ─── Dropdown Panel ─────────────────────────────────────────────── */
function DropdownPanel({ data, open, onNavigate, onMouseEnter, onMouseLeave, isAuthenticated }) {
  const { sections, cta } = data;

  return (
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        opacity: open ? 1 : 0,
        transform: open ? "translateY(0) scale(1)" : "translateY(-6px) scale(0.98)",
        pointerEvents: open ? "all" : "none",
        transition: "opacity 160ms ease, transform 160ms ease",
        transformOrigin: "top center",
      }}
      className="absolute left-1/2 -translate-x-1/2 top-full pt-2 w-[620px] z-50"
    >
      {/* inner card */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-2xl shadow-slate-200/60 overflow-hidden">
        {/* tiny arrow */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-l border-t border-slate-100 rotate-45" />

        <div className={`grid gap-0 ${sections.length === 2 ? "grid-cols-2" : "grid-cols-1"} p-5`}>
          {sections.map((sec) => (
            <div key={sec.title} className="space-y-0.5">
              <p className="text-[10px] font-bold tracking-[0.12em] text-slate-400 uppercase px-2 mb-2">
                {sec.title}
              </p>
              {sec.items.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => onNavigate(item)}
                  className="group flex items-center gap-3 w-full px-2 py-2.5 rounded-xl hover:bg-slate-50 transition-colors text-left"
                >
                  <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100 transition-colors flex-shrink-0">
                    <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-800 group-hover:text-indigo-700 transition-colors">
                        {item.label}
                      </span>
                      {item.badge && (
                        <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-indigo-500 text-white uppercase tracking-wide">
                          {item.badge}
                        </span>
                      )}
                      {item.auth && !isAuthenticated && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] text-slate-400 bg-slate-100 font-medium">
                          Login required
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5 truncate">{item.sub}</p>
                  </div>
                  <span className="material-symbols-outlined text-[14px] text-slate-300 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all">
                    arrow_forward
                  </span>
                </button>
              ))}
            </div>
          ))}
        </div>

        {/* CTA footer */}
        <div className="border-t border-slate-50 px-5 py-3 bg-slate-50/80">
          <button
            type="button"
            onClick={() => onNavigate(cta)}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
          >
            {cta.label}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main MegaNav ───────────────────────────────────────────────── */
export default function MegaNav({ enterWithPera }) {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const [openMenu, setOpenMenu] = useState(null);
  const closeTimer = useRef(null);

  const keepOpen = (key) => {
    clearTimeout(closeTimer.current);
    setOpenMenu(key);
  };

  const scheduleClose = () => {
    closeTimer.current = setTimeout(() => setOpenMenu(null), 180);
  };

  /** Handle item click — gate auth-required routes */
  const handleItemClick = (item) => {
    setOpenMenu(null);

    // scroll target
    if (item.scroll) {
      goToHomeSection(navigate, item.scroll);
      return;
    }

    // no path
    if (!item.path) return;

    // auth required & not logged in → trigger Pera wallet connection
    if (item.auth && !isAuthenticated) {
      const role = item.creatorOnly ? "creator" : "user";
      if (enterWithPera) enterWithPera(role, { redirect: item.path });
      return;
    }

    navigate(item.path);
  };

  const handleConnectWallet = () => {
    if (isAuthenticated) {
      navigate("/dashboard/home");
    } else {
      if (enterWithPera) enterWithPera("user");
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-slate-100 shadow-sm">
      <div className="max-w-screen-xl mx-auto px-6 h-14 flex items-center justify-between">

        {/* Left: logo + nav */}
        <div className="flex items-center gap-7">
          <Link
            to="/"
            className="flex items-center gap-2 text-base font-semibold text-[#031634] tracking-tight font-headline flex-shrink-0"
          >
            <img
              src={logo}
              alt="Sentinal Logo"
              className="w-7 h-7 rounded-lg object-contain bg-white p-0.5 border border-slate-200"
            />
            <span>Sentinal</span>
          </Link>

          <nav className="hidden md:flex items-center gap-0.5">
            {/* Mega-dropdown items */}
            {Object.entries(menus).map(([key, data]) => (
              <div
                key={key}
                className="relative"
                onMouseEnter={() => keepOpen(key)}
                onMouseLeave={scheduleClose}
              >
                <button
                  type="button"
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                    openMenu === key
                      ? "bg-slate-100 text-slate-900"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  {key}
                  <span
                    className="material-symbols-outlined text-[14px] transition-transform duration-200"
                    style={{ transform: openMenu === key ? "rotate(180deg)" : "rotate(0deg)" }}
                  >
                    expand_more
                  </span>
                </button>

                {/* Panel: has its own mouse handlers to keep it open when cursor is on it */}
                <DropdownPanel
                  data={data}
                  open={openMenu === key}
                  onNavigate={handleItemClick}
                  onMouseEnter={() => keepOpen(key)}
                  onMouseLeave={scheduleClose}
                  isAuthenticated={isAuthenticated}
                />
              </div>
            ))}

            {/* "How It Works" plain link */}
            <Link
              to="/docs/how-it-works"
              className="px-3 py-1.5 rounded-lg text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              How It Works
            </Link>


          </nav>
        </div>

        {/* Right: wallet + profile */}
        <div className="flex items-center gap-3">
          {isAuthenticated && user?.walletAddress && (
            <UserLiveWalletBar walletAddress={user.walletAddress} />
          )}
          {isAuthenticated ? (
            <ProfileDropdown />
          ) : (
            <button
              type="button"
              onClick={handleConnectWallet}
              className="flex items-center gap-2 px-4 py-1.5 bg-[#031634] text-white rounded-full text-sm font-semibold hover:bg-[#0a2855] active:scale-95 transition-all shadow-sm cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">account_balance_wallet</span>
              Connect Wallet
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
