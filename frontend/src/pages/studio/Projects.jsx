import React from "react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { api } from "../../api/client.js";

export default function Projects() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [brandVoice, setBrandVoice] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["studio-projects"],
    queryFn: async () => (await api.get("/api/studio/projects")).data,
  });

  const createM = useMutation({
    mutationFn: () =>
      api.post("/api/studio/projects", {
        title: title || "Untitled project",
        description,
        brandVoice,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["studio-projects"] });
      toast.success("Project created");
      setOpen(false);
      setTitle("");
      setDescription("");
      setBrandVoice("");
    },
    onError: (e) => toast.error(e?.response?.data?.error || e.message),
  });

  const projects = data?.projects ?? [];

  return (
    <div className="pt-6">
      <header className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-headline text-2xl font-semibold text-primary">Projects</h1>
          <p className="text-sm text-on-surface-variant mt-1">Brand voice, platforms, and blog output grouped by initiative.</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="px-4 py-2 rounded-md bg-[#031634] text-white text-sm font-semibold"
        >
          New project
        </button>
      </header>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-4">
          <div className="bg-white rounded-md border border-surface-variant max-w-md w-full p-5 shadow-lg">
            <h2 className="font-semibold text-primary mb-3">Create project</h2>
            <label className="text-xs text-slate-600 block mb-1">Title</label>
            <input className="w-full border rounded-md px-3 py-2 text-sm mb-3" value={title} onChange={(e) => setTitle(e.target.value)} />
            <label className="text-xs text-slate-600 block mb-1">Description</label>
            <textarea className="w-full border rounded-md px-3 py-2 text-sm mb-3" value={description} onChange={(e) => setDescription(e.target.value)} />
            <label className="text-xs text-slate-600 block mb-1">Brand voice</label>
            <textarea className="w-full border rounded-md px-3 py-2 text-sm mb-4" value={brandVoice} onChange={(e) => setBrandVoice(e.target.value)} />
            <div className="flex gap-2 justify-end">
              <button type="button" className="px-3 py-2 text-sm border rounded-md" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button type="button" className="px-3 py-2 text-sm bg-[#031634] text-white rounded-md" onClick={() => createM.mutate()} disabled={createM.isPending}>
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {isLoading && <p className="text-sm text-on-surface-variant animate-pulse">Loading…</p>}

      <div className="grid gap-4 sm:grid-cols-2">
        {projects.map((p) => (
          <motion.div key={p._id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }} whileHover={{ y: -4 }}>
            <Link
              to={`/studio/projects/${p._id}`}
              className="block bg-white border border-surface-variant rounded-md p-5 h-full hover:border-secondary transition-colors"
            >
              <div className="w-1 h-10 rounded-full mb-3" style={{ backgroundColor: p.color || "#031634" }} />
              <h2 className="font-semibold text-primary">{p.title}</h2>
              <p className="text-xs text-on-surface-variant mt-2 line-clamp-2">{p.description || "—"}</p>
            </Link>
          </motion.div>
        ))}
      </div>
      {!isLoading && projects.length === 0 && <p className="text-sm text-on-surface-variant">No projects yet.</p>}
    </div>
  );
}
