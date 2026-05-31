import React, { useState } from "react";
import { Outlet } from "react-router-dom";
import MegaNav from "../components/MegaNav.jsx";
import DocsSidebar from "../components/DocsSidebar.jsx";

export default function DocsLayout() {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className="antialiased min-h-screen bg-white">
      {/* Top Navigation */}
      <MegaNav />

      {/* Main Layout Container */}
      <div className="flex max-w-[1440px] mx-auto w-full pt-14 relative">
        {/* Left Sidebar Menu */}
        <DocsSidebar isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} />

        {/* Dynamic Content Area (Contains Center Content + Right TOC) */}
        <main className={`flex-1 min-w-0 transition-all duration-300 ${isCollapsed ? "md:pl-16" : "md:pl-0"}`}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
