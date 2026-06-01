import React, { useState, useRef, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
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
          { icon: "integration_instructions", label: "x402 Payments",    sub: "Keyless agent transactions",   path: "/docs/x402",    badge: "NEW" },
          { icon: "monitoring",               label: "Analytics",         sub: "Usage & revenue dashboards",  path: "/studio/analytics",  auth: true  },
          { icon: "gavel",                    label: "Smart Contract",    sub: "On-chain ledger stats & logs", path: "/dashboard/contract", auth: true, badge: "LIVE" },
          { icon: "smart_toy",                label: "Agentic Workflows", sub: "n8n & LangChain integration", path: "/docs/x402-api" },
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
          { icon: "api",       label: "REST & x402 APIs",    sub: "Keyless M2M payments",            path: "/docs/x402-api" },
          { icon: "hub",       label: "Multi-Agent Systems", sub: "Orchestrate autonomous agents",   path: "/docs/x402" },
        ],
      },
      {
        title: "For Creators",
        items: [
          { icon: "edit_note", label: "Blogging Agent",      sub: "Auto-publish articles",           path: "/studio/blogging-agent",  auth: true },
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
          { icon: "menu_book", label: "x402 Protocol Docs",  sub: "Full API reference",              path: "/docs/x402" },
          { icon: "terminal",  label: "Code Examples",       sub: "cURL, JS, Python snippets",       path: "/docs/x402-api" },
          { icon: "code",      label: "Developer SDK",       sub: "JS/TS client library & demo",     path: "/sdk-demo" },
        ],
      },
    ],
    cta: { label: "Explore API Docs →", path: "/docs/x402" },
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
        transition: "opacity 300ms ease-out, transform 300ms ease-out",
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
function collectMobileLinks() {
  const links = [];
  Object.entries(menus).forEach(([menuName, data]) => {
    data.sections.forEach((sec) => {
      sec.items.forEach((item) => {
        links.push({ ...item, menuName, section: sec.title });
      });
    });
  });
  links.push({
    label: "How It Works",
    sub: "Pay-per-use AI on Algorand",
    path: "/docs/how-it-works",
    icon: "help",
  });
  links.push({
    label: "SDK",
    sub: "JavaScript / TypeScript client",
    path: "/sdk-demo",
    icon: "code",
  });
  return links;
}

export default function MegaNav({ enterWithPera }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, user } = useAuth();
  const [openMenu, setOpenMenu] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const closeTimer = useRef(null);

  // Scroll listener for premium header dynamic classes
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 15);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const keepOpen = (key) => {
    clearTimeout(closeTimer.current);
    setOpenMenu(key);
  };

  const scheduleClose = () => {
    closeTimer.current = setTimeout(() => setOpenMenu(null), 350);
  };

  /** Handle item click — gate auth-required routes */
  const handleItemClick = (item) => {
    setOpenMenu(null);
    setMobileOpen(false);

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
    setMobileOpen(false);
    if (isAuthenticated) {
      navigate("/dashboard/home");
    } else {
      if (enterWithPera) enterWithPera("user");
    }
  };

  /* ─── All mobile nav items flattened ─── */
  const mobileLinks = Object.entries(menus).flatMap(([, data]) =>
    data.sections.flatMap((sec) => sec.items)
  );

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      scrolled
        ? "bg-white/80 backdrop-blur-md border-b border-slate-200/50 shadow-md py-0.5"
        : "bg-white/50 backdrop-blur-sm border-b border-slate-100/30 shadow-sm py-1.5"
    }`}>
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
            {/* Product Dropdown */}
            <div
              className="relative"
              onMouseEnter={() => keepOpen("Product")}
              onMouseLeave={scheduleClose}
            >
              <button
                type="button"
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                  openMenu === "Product"
                    ? "bg-slate-100 text-slate-900"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                }`}
              >
                Product
                <span
                  className="material-symbols-outlined text-[14px] transition-transform duration-200"
                  style={{ transform: openMenu === "Product" ? "rotate(180deg)" : "rotate(0deg)" }}
                >
                  expand_more
                </span>
              </button>
              <DropdownPanel
                data={menus.Product}
                open={openMenu === "Product"}
                onNavigate={handleItemClick}
                onMouseEnter={() => keepOpen("Product")}
                onMouseLeave={scheduleClose}
                isAuthenticated={isAuthenticated}
              />
            </div>

            {/* Use Cases Dropdown */}
            <div
              className="relative"
              onMouseEnter={() => keepOpen("Use Cases")}
              onMouseLeave={scheduleClose}
            >
              <button
                type="button"
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                  openMenu === "Use Cases"
                    ? "bg-slate-100 text-slate-900"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                }`}
              >
                Use Cases
                <span
                  className="material-symbols-outlined text-[14px] transition-transform duration-200"
                  style={{ transform: openMenu === "Use Cases" ? "rotate(180deg)" : "rotate(0deg)" }}
                >
                  expand_more
                </span>
              </button>
              <DropdownPanel
                data={menus["Use Cases"]}
                open={openMenu === "Use Cases"}
                onNavigate={handleItemClick}
                onMouseEnter={() => keepOpen("Use Cases")}
                onMouseLeave={scheduleClose}
                isAuthenticated={isAuthenticated}
              />
            </div>


            {/* Resources Dropdown */}
            <div
              className="relative"
              onMouseEnter={() => keepOpen("Resources")}
              onMouseLeave={scheduleClose}
            >
              <button
                type="button"
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                  openMenu === "Resources"
                    ? "bg-slate-100 text-slate-900"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                }`}
              >
                Resources
                <span
                  className="material-symbols-outlined text-[14px] transition-transform duration-200"
                  style={{ transform: openMenu === "Resources" ? "rotate(180deg)" : "rotate(0deg)" }}
                >
                  expand_more
                </span>
              </button>
              <DropdownPanel
                data={menus.Resources}
                open={openMenu === "Resources"}
                onNavigate={handleItemClick}
                onMouseEnter={() => keepOpen("Resources")}
                onMouseLeave={scheduleClose}
                isAuthenticated={isAuthenticated}
              />
            </div>
          </nav>
        </div>

        {/* Right: wallet + profile + hamburger */}
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
              className="hidden md:flex items-center gap-2 px-4 py-1.5 bg-[#031634] text-white rounded-full text-sm font-semibold hover:bg-[#0a2855] active:scale-95 transition-all shadow-sm cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">account_balance_wallet</span>
              Connect Wallet
            </button>
          )}

          {/* Hamburger button — mobile only */}
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            className="md:hidden flex items-center justify-center w-9 h-9 rounded-lg hover:bg-slate-100 transition-colors"
            aria-label="Toggle mobile menu"
          >
            <span className="material-symbols-outlined text-[22px] text-slate-700">
              {mobileOpen ? "close" : "menu"}
            </span>
          </button>
        </div>
      </div>

      {/* ─── Mobile slide-out menu ─── */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 top-14 z-40 bg-white overflow-y-auto animate-in slide-in-from-top-2">
          <nav className="px-6 py-6 space-y-1">
            {Object.entries(menus).map(([key, data]) => (
              <div key={key} className="mb-4">
                <p className="text-[10px] font-bold tracking-[0.12em] text-slate-400 uppercase mb-2">
                  {key}
                </p>
                {data.sections.map((sec) =>
                  sec.items.map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => handleItemClick(item)}
                      className="flex items-center gap-3 w-full px-3 py-3 rounded-xl hover:bg-slate-50 transition-colors text-left"
                    >
                      <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex-shrink-0">
                        <span className="material-symbols-outlined text-[16px]">{item.icon}</span>
                      </span>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-semibold text-slate-800">{item.label}</span>
                        <p className="text-xs text-slate-400 truncate">{item.sub}</p>
                      </div>
                      {item.badge && (
                        <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-indigo-500 text-white uppercase">
                          {item.badge}
                        </span>
                      )}
                    </button>
                  ))
                )}
              </div>
            ))}

            <Link
              to="/docs/how-it-works"
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-slate-50 transition-colors"
            >
              <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex-shrink-0">
                <span className="material-symbols-outlined text-[16px]">info</span>
              </span>
              <span className="text-sm font-semibold text-slate-800">How It Works</span>
            </Link>

            {!isAuthenticated && (
              <div className="pt-4 border-t border-slate-100 mt-4">
                <button
                  type="button"
                  onClick={handleConnectWallet}
                  className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-[#031634] text-white rounded-xl text-sm font-semibold hover:bg-[#0a2855] active:scale-95 transition-all"
                >
                  <span className="material-symbols-outlined text-[16px]">account_balance_wallet</span>
                  Connect Wallet
                </button>
              </div>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}

