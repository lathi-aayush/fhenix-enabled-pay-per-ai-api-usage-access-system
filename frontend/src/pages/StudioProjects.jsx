import React from "react";
import logo from "../assets/logo.png";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import UserLiveWalletBar from "../components/UserLiveWalletBar.jsx";
import ProfileDropdown from "../components/ProfileDropdown.jsx";
import StudioSidebar from "../components/StudioSidebar.jsx";

const projects = [
  { name: "YouTube Shorts", jobs: 6, exports: 14, status: "Active" },
  { name: "Podcast Clips", jobs: 3, exports: 8, status: "Rendering" },
  { name: "Blog Campaigns", jobs: 5, exports: 12, status: "Drafting" },
];

export default function StudioProjects() {
  const { user } = useAuth();
  return (
    <div className="antialiased min-h-screen bg-[#f9f9f9]">
      <header className="bg-white fixed top-0 z-50 w-full border-b border-slate-100 h-16 px-6 flex justify-between items-center font-body text-sm">
        <Link to="/" className="flex items-center gap-2 text-xl font-bold tracking-tight font-headline text-slate-900">
          <img src={logo} alt="Sentinal Logo" className="w-8 h-8 rounded-lg object-contain bg-white p-0.5 border border-slate-200" />
          <span>Sentinal</span>
        </Link>
        <div className="flex items-center gap-4">
          {user?.walletAddress && <UserLiveWalletBar walletAddress={user.walletAddress} />}
          <ProfileDropdown />
        </div>
      </header>
      <StudioSidebar activeTab="projects" />
      <main className="md:pl-64 pt-24 px-6 pb-16 max-w-5xl">
        <h1 className="font-headline text-2xl font-semibold text-primary mb-2">Studio Projects</h1>
        <p className="text-sm text-on-surface-variant mb-6">Organize renders, generations, and exports by project.</p>
        <div className="space-y-3">
          {projects.map((p) => (
            <div key={p.name} className="bg-white border border-surface-variant rounded-md p-4 flex items-center justify-between">
              <div>
                <p className="font-semibold text-primary">{p.name}</p>
                <p className="text-xs text-on-surface-variant mt-1">{p.jobs} jobs · {p.exports} exports</p>
              </div>
              <span className="text-xs px-2 py-1 rounded bg-slate-100 text-slate-700">{p.status}</span>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
