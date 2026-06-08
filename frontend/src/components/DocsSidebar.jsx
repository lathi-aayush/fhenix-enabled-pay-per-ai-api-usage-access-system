import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";

export default function DocsSidebar({ isCollapsed, setIsCollapsed }) {
  const location = useLocation();
  const [expanded, setExpanded] = useState({
    protocol: true,
    sdk: true,
  });

  const toggle = (section) => setExpanded(p => ({ ...p, [section]: !p[section] }));

  const isActive = (path) => location.pathname === path;

  return (
    <aside className={`w-64 shrink-0 hidden md:flex flex-col border-r border-slate-200 h-[calc(100vh-56px)] bg-white sticky top-14 transition-all duration-300 z-40 ${isCollapsed ? "-ml-64" : "ml-0"}`}>
      {/* Floating Toggle Button */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute top-4 w-8 h-8 bg-white/80 dark:bg-[#1A1C1C]/80 backdrop-blur border border-slate-200/80 dark:border-slate-800/80 shadow-md rounded-xl flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-800 transition-all duration-300 cursor-pointer z-50 text-slate-600 dark:text-slate-300"
        style={{ left: isCollapsed ? "calc(100% + 12px)" : "calc(100% - 44px)" }}
        title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
      >
        <span className="material-symbols-outlined text-[18px]">
          {isCollapsed ? "menu" : "menu_open"}
        </span>
      </button>

      <div className={`flex-1 overflow-y-auto flex flex-col pt-8 transition-opacity duration-300 ${isCollapsed ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
        <div className="px-6 mb-8">
          <h3 className="text-slate-900 font-semibold">Documentation</h3>
          <p className="text-slate-500 text-xs">Sentinal Protocol Guides</p>
        </div>
        <ul className="space-y-1 text-[13px] font-medium text-slate-600 px-4 pb-8">
          <li>
            <Link to="/docs" className={`block px-3 py-1.5 rounded transition-colors ${isActive('/docs') ? 'bg-indigo-50/50 text-indigo-700 font-semibold' : 'hover:bg-slate-50'}`}>
              Home
            </Link>
          </li>
          <li>
            <Link to="/docs/how-it-works" className={`block px-3 py-1.5 rounded transition-colors ${isActive('/docs/how-it-works') ? 'bg-indigo-50/50 text-indigo-700 font-semibold' : 'hover:bg-slate-50'}`}>
              How It Works
            </Link>
          </li>
          <li>
            <Link to="/docs/withdrawal" className={`block px-3 py-1.5 rounded transition-colors ${isActive('/docs/withdrawal') ? 'bg-indigo-50/50 text-indigo-700 font-semibold' : 'hover:bg-slate-50'}`}>
              Payouts & Withdrawals
            </Link>
          </li>
          
          <li className="pt-4 pb-1">
            <button 
              onClick={() => toggle("protocol")}
              className="flex items-center justify-between w-full px-3 py-1.5 rounded hover:bg-slate-50 transition-colors"
            >
              <span className={`text-slate-900 ${location.pathname.includes('x402') || location.pathname.includes('cli') || location.pathname.includes('migration') ? 'font-semibold' : ''}`}>Sentinal Protocol</span>
              <span className="material-symbols-outlined text-[16px] text-slate-400">
                {expanded.protocol ? "expand_more" : "chevron_right"}
              </span>
            </button>
            
            {expanded.protocol && (
              <ul className="mt-2 ml-3 pl-3 border-l border-slate-200 space-y-1">
                <li>
                  <Link 
                    to="/docs/x402" 
                    className={`block px-3 py-1.5 rounded transition-colors ${isActive('/docs/x402') ? 'bg-indigo-50/50 text-indigo-700 font-semibold' : 'hover:bg-slate-50 text-slate-500 hover:text-slate-800'}`}
                  >
                    Getting Started
                  </Link>
                </li>
                <li>
                  <Link 
                    to="/docs/x402-api" 
                    className={`block px-3 py-1.5 rounded transition-colors ${isActive('/docs/x402-api') ? 'bg-indigo-50/50 text-indigo-700 font-semibold' : 'hover:bg-slate-50 text-slate-500 hover:text-slate-800'}`}
                  >
                    API Reference
                  </Link>
                </li>
                <li>
                  <Link 
                    to="/docs/playground" 
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition-colors ${isActive('/docs/playground') ? 'bg-indigo-50/50 text-indigo-700 font-semibold' : 'hover:bg-slate-50 text-slate-500 hover:text-slate-800'}`}
                  >
                    <span>⚡</span>
                    <span>x402 Sandbox</span>
                    <span className="ml-auto text-[9px] font-bold bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full uppercase tracking-wider">New</span>
                  </Link>
                </li>
                <li>
                  <Link 
                    to="/docs/cli" 
                    className={`block px-3 py-1.5 rounded transition-colors ${isActive('/docs/cli') ? 'bg-indigo-50/50 text-indigo-700 font-semibold' : 'hover:bg-slate-50 text-slate-500 hover:text-slate-800'}`}
                  >
                    CLI Tool
                  </Link>
                </li>
                <li>
                  <Link 
                    to="/docs/migration" 
                    className={`block px-3 py-1.5 rounded transition-colors ${isActive('/docs/migration') ? 'bg-indigo-50/50 text-indigo-700 font-semibold' : 'hover:bg-slate-50 text-slate-500 hover:text-slate-800'}`}
                  >
                    Migration Guide
                  </Link>
                </li>
              </ul>
            )}
          </li>

          <li className="pt-4 pb-1">
            <button 
              onClick={() => toggle("sdk")}
              className="flex items-center justify-between w-full px-3 py-1.5 rounded hover:bg-slate-50 transition-colors"
            >
              <span className={`text-slate-900 ${isActive('/sdk-demo') ? 'font-semibold' : ''}`}>SDK Client</span>
              <span className="material-symbols-outlined text-[16px] text-slate-400">
                {expanded.sdk ? "expand_more" : "chevron_right"}
              </span>
            </button>
            
            {expanded.sdk && (
              <ul className="mt-2 ml-3 pl-3 border-l border-slate-200 space-y-1">
                <li>
                  <Link 
                    to="/sdk-demo" 
                    className={`block px-3 py-1.5 rounded transition-colors ${isActive('/sdk-demo') ? 'bg-indigo-50/50 text-indigo-700 font-semibold' : 'hover:bg-slate-50 text-slate-500 hover:text-slate-800'}`}
                  >
                    Interactive Demo
                  </Link>
                </li>
                <li>
                  <a 
                    href="https://www.npmjs.com/package/@sentinalapi/sdk"
                    target="_blank"
                    rel="noreferrer"
                    className="block px-3 py-1.5 rounded transition-colors hover:bg-slate-50 text-slate-500 hover:text-slate-800 flex items-center gap-1"
                  >
                    npm Package
                    <span className="material-symbols-outlined text-[12px] text-slate-400">open_in_new</span>
                  </a>
                </li>
                <li>
                  <a 
                    href="https://github.com/lathi-aayush/pay-per-usage-ai-api-access-system-using-algorand/tree/main/sdk"
                    target="_blank"
                    rel="noreferrer"
                    className="block px-3 py-1.5 rounded transition-colors hover:bg-slate-50 text-slate-500 hover:text-slate-800 flex items-center gap-1"
                  >
                    GitHub Source
                    <span className="material-symbols-outlined text-[12px] text-slate-400">open_in_new</span>
                  </a>
                </li>
              </ul>
            )}
          </li>

          <li className="pt-4">
            <Link to="/docs/pricing" className={`block px-3 py-1.5 rounded transition-colors ${isActive('/docs/pricing') ? 'bg-indigo-50/50 text-indigo-700 font-semibold' : 'hover:bg-slate-50'}`}>
              Pricing & Micro-payments
            </Link>
          </li>
          <li>
            <Link to="/docs/faq" className={`block px-3 py-1.5 rounded transition-colors ${isActive('/docs/faq') ? 'bg-indigo-50/50 text-indigo-700 font-semibold' : 'hover:bg-slate-50'}`}>
              FAQ
            </Link>
          </li>
        </ul>
      </div>
    </aside>
  );
}
