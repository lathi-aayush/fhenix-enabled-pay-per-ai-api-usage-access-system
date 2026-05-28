import React from "react";

const HOSTED_APPS = [
  {
    id: "image",
    title: "Sentinal Image Studio",
    description: "Generate images using Stable Diffusion or DALL-E models using your Sentinal keys.",
    icon: "image",
    url: "https://image.example.com",
  },
  {
    id: "coder",
    title: "Sentinal Coder",
    description: "An AI coding assistant web UI optimized for coding tasks and code generation.",
    icon: "code",
    url: "https://code.example.com",
  },
];

const APP_SECTIONS = [
  { title: "Featured Apps", ids: ["image"] },
  { title: "Creator Tools", ids: ["image"] },
  { title: "Developer Tools", ids: ["coder"] },
  { title: "Community Apps", ids: ["coder"] },
];

export default function HostedApps() {
  return (
    <div className="max-w-5xl">
      <div className="relative mb-10 overflow-hidden rounded-2xl bg-slate-900 p-8 text-white editorial-shadow">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 rounded-full bg-secondary opacity-20 blur-3xl"></div>
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-64 h-64 rounded-full bg-primary opacity-30 blur-3xl"></div>
        <div className="relative z-10">
          <h1 className="font-headline text-3xl font-semibold mb-2 tracking-tight">Apps</h1>
          <p className="text-slate-300 max-w-lg">
            Discover the SentinelAI app ecosystem across creator tools, developer tools, and community-built apps.
          </p>
        </div>
      </div>

      <section className="mb-14 bg-gradient-to-br from-primary-container/80 to-primary-container/30 border border-primary/20 rounded-2xl p-6 shadow-sm">
        <h2 className="font-semibold text-primary text-base">Creator App Workflows</h2>
        <p className="text-sm text-on-surface-variant mt-1">
          Launch tools for content generation, editing, and production workflows. Marketplace infrastructure stays in its own workspace.
        </p>
      </section>

      {APP_SECTIONS.map((section) => (
        <section key={section.title} className="mb-12">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="font-semibold text-primary text-xl">{section.title}</h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {HOSTED_APPS.filter((app) => section.ids.includes(app.id)).map((app) => (
              <div
                key={`${section.title}-${app.id}`}
                className="bg-white border border-surface-variant rounded-2xl p-6 flex flex-col hover:border-secondary/50 hover:shadow-lg transition-all duration-300 group hover:-translate-y-1 relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-primary-container/40 to-transparent rounded-bl-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
                <div className="w-14 h-14 bg-slate-50 rounded-xl flex items-center justify-center mb-5 group-hover:bg-primary group-hover:text-white text-primary transition-colors duration-300 border border-slate-100 shadow-sm">
                  <span className="material-symbols-outlined text-[28px]">{app.icon}</span>
                </div>
                <h3 className="font-headline font-semibold text-slate-900 text-lg">{app.title}</h3>
                <p className="text-sm text-slate-500 mt-2 flex-1 leading-relaxed">{app.description}</p>
                <a
                  href={app.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-8 inline-flex items-center justify-center gap-2 w-full py-2.5 bg-white border-2 border-slate-900 text-slate-900 rounded-lg text-sm font-semibold hover:bg-slate-900 hover:text-white transition-colors duration-300"
                >
                  Launch App
                  <span className="material-symbols-outlined text-[18px] group-hover:translate-x-1 transition-transform">arrow_forward</span>
                </a>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
