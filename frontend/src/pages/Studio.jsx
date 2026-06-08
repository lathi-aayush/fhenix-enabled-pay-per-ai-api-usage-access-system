import React from "react";
import logo from "../assets/logo.png";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import UserLiveWalletBar from "../components/UserLiveWalletBar.jsx";
import ProfileDropdown from "../components/ProfileDropdown.jsx";
import StudioSidebar from "../components/StudioSidebar.jsx";

const TOOLS = [
  { title: "Video Editor", path: "/studio/video-editor", icon: "movie", jobs: 4 },
  { title: "Blog Writer", path: "/studio/blog-writer", icon: "article", jobs: 7 },
  { title: "Data Analyst", path: "/studio/data-analyst", icon: "monitoring", jobs: 3 },
];

export default function Studio() {
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
      <StudioSidebar activeTab="studio-home" />

      <main className="md:pl-64 pt-24 px-6 pb-16 max-w-6xl">
        <div className="mb-8">
          <h1 className="font-headline text-2xl font-semibold text-primary">Studio</h1>
          <p className="text-on-surface-variant text-sm mt-1">Creator workspace for tools, projects, active jobs, and exports.</p>
        </div>

        <section className="grid gap-4 sm:grid-cols-3 mb-8">
          {TOOLS.map((tool) => (
            <Link key={tool.title} to={tool.path} className="bg-white border border-surface-variant rounded-md p-5 hover:border-secondary transition-all hover:-translate-y-0.5">
              <span className="material-symbols-outlined text-slate-700">{tool.icon}</span>
              <h2 className="font-semibold text-primary mt-2">{tool.title}</h2>
              <p className="text-xs text-on-surface-variant mt-1">{tool.jobs} active generations</p>
            </Link>
          ))}
        </section>

        <section className="grid gap-4 lg:grid-cols-2 mb-6">
          <div className="bg-white border border-surface-variant rounded-md p-5">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-primary">Recent Projects</h3>
              <Link to="/studio/projects" className="text-xs text-secondary underline">View all</Link>
            </div>
            <ul className="mt-4 space-y-3 text-sm">
              <li className="flex justify-between"><span>YouTube Shorts</span><span className="text-on-surface-variant">12 assets</span></li>
              <li className="flex justify-between"><span>Podcast Clips</span><span className="text-on-surface-variant">8 assets</span></li>
              <li className="flex justify-between"><span>Blog Campaigns</span><span className="text-on-surface-variant">21 drafts</span></li>
            </ul>
          </div>
          <div className="bg-white border border-surface-variant rounded-md p-5">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-primary">Render Queue</h3>
              <Link to="/studio/queue" className="text-xs text-secondary underline">Open queue</Link>
            </div>
            <ul className="mt-4 space-y-3 text-sm">
              <li className="flex justify-between"><span>Queued</span><span className="font-mono">5</span></li>
              <li className="flex justify-between"><span>Rendering</span><span className="font-mono">3</span></li>
              <li className="flex justify-between"><span>Completed today</span><span className="font-mono">18</span></li>
            </ul>
          </div>
        </section>

        <section className="bg-white border border-surface-variant rounded-md p-5">
          <h3 className="font-semibold text-primary">Recent Exports</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-xs">
            {["clip-v12.mp4", "campaign-post-3.md", "insight-board.pdf", "shorts-pack.zip"].map((item) => (
              <div key={item} className="border border-slate-100 rounded-md px-3 py-2 text-on-surface-variant">{item}</div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
