import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";

export default function DocsSidebar() {
  const location = useLocation();
  const [expanded, setExpanded] = useState({
    protocol: true,
  });

  const toggle = (section) => setExpanded(p => ({ ...p, [section]: !p[section] }));

  const isActive = (path) => location.pathname === path;

  return (
    <aside className="w-64 shrink-0 hidden md:block border-r border-slate-200 h-[calc(100vh-56px)] overflow-y-auto bg-white sticky top-14">
      <div className="px-4 py-8">
        <ul className="space-y-1 text-[13px] font-medium text-slate-600">
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
          
          <li className="pt-4 pb-1">
            <button 
              onClick={() => toggle("protocol")}
              className="flex items-center justify-between w-full px-3 py-1.5 rounded hover:bg-slate-50 transition-colors"
            >
              <span className={`text-slate-900 ${location.pathname.includes('x402') ? 'font-semibold' : ''}`}>x402 Protocol</span>
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
              </ul>
            )}
          </li>
          
          <li className="pt-4 pb-1">
            <button className="flex items-center justify-between w-full px-3 py-1.5 rounded hover:bg-slate-50 text-slate-900 transition-colors">
              <span>Settings</span>
              <span className="material-symbols-outlined text-[16px] text-slate-400">expand_more</span>
            </button>
          </li>
          
        </ul>
      </div>
    </aside>
  );
}
