import React from "react";
import ComingSoon from "../components/ComingSoon.jsx";

const HOSTED_APPS = [
  {
    id: "image",
    title: "Sentinal Image Studio",
    description: "Generate images using Stable Diffusion or DALL-E models using your Sentinal keys.",
    icon: "image",
  },
  {
    id: "coder",
    title: "Sentinal Coder",
    description: "An AI coding assistant web UI optimized for coding tasks and code generation.",
    icon: "code",
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
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 rounded-full bg-secondary opacity-20 blur-3xl" />
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-64 h-64 rounded-full bg-primary opacity-30 blur-3xl" />
        <div className="relative z-10">
          <h1 className="font-headline text-3xl font-semibold mb-2 tracking-tight">Apps</h1>
          <p className="text-slate-300 max-w-lg">
            Discover the SentinalAI app ecosystem. Hosted apps are coming soon.
          </p>
        </div>
      </div>

      {APP_SECTIONS.map((section) => (
        <section key={section.title} className="mb-12">
          <h2 className="font-semibold text-primary text-xl mb-4">{section.title}</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {HOSTED_APPS.filter((app) => section.ids.includes(app.id)).map((app) => (
              <div
                key={`${section.title}-${app.id}`}
                className="bg-slate-50 border border-surface-variant rounded-2xl p-6 flex flex-col opacity-75"
              >
                <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center mb-5 text-slate-400 border border-slate-100">
                  <span className="material-symbols-outlined text-[28px]">{app.icon}</span>
                </div>
                <h3 className="font-headline font-semibold text-slate-600 text-lg">{app.title}</h3>
                <p className="text-sm text-slate-500 mt-2 flex-1 leading-relaxed">{app.description}</p>
                <span className="mt-8 inline-flex items-center justify-center gap-2 w-full py-2.5 bg-slate-200 text-slate-500 rounded-lg text-sm font-semibold cursor-not-allowed">
                  Coming Soon
                </span>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
