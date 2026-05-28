import React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { api } from "../../api/client.js";

const TONES = ["professional", "casual", "educational", "technical", "storytelling", "persuasive"];
const PLATFORMS = [
  { id: "devto", label: "Dev.to" },
  { id: "medium", label: "Medium" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "hashnode", label: "Hashnode" },
  { id: "wordpress", label: "WordPress" },
  { id: "sentinel-studio", label: "Sentinel Studio (internal)" },
];

const API_BASE = import.meta.env.VITE_API_URL ?? "";

function getToken() {
  return localStorage.getItem("sentinal_token");
}

function wordCountFromHtml(html) {
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (!text) return 0;
  return text.split(/\s+/).length;
}

function readingTime(wc) {
  return Math.max(1, Math.ceil(wc / 200));
}

/** Format API date for `<input type="datetime-local" />` */
function toDatetimeLocalValue(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function BloggingAgent() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const initialPostId = searchParams.get("post") || location.state?.postId;

  const [projectId, setProjectId] = useState("");
  const [topic, setTopic] = useState("");
  const [kwInput, setKwInput] = useState("");
  const [keywords, setKeywords] = useState([]);
  const [tone, setTone] = useState("professional");
  const [targetAudience, setTargetAudience] = useState("");
  const [wordCountTarget, setWordCountTarget] = useState(1000);
  const [brandVoice, setBrandVoice] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState(["devto"]);
  const [publishError, setPublishError] = useState("");
  const [publishedLinks, setPublishedLinks] = useState([]);
  const [scheduledFor, setScheduledFor] = useState("");

  const [postId, setPostId] = useState(initialPostId || null);
  const [title, setTitle] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [status, setStatus] = useState("draft");

  const [titleSuggestions, setTitleSuggestions] = useState([]);
  const [seoScore, setSeoScore] = useState(null);
  const [hashtags, setHashtags] = useState([]);
  const [metaDescription, setMetaDescription] = useState("");
  const [socialTab, setSocialTab] = useState("linkedin");
  const [socialSnippets, setSocialSnippets] = useState({ linkedin: "", twitter: "" });

  const { data: usage } = useQuery({
    queryKey: ["studio-usage"],
    queryFn: async () => (await api.get("/api/studio/usage")).data,
  });
  const { data: projectsRes } = useQuery({
    queryKey: ["studio-projects"],
    queryFn: async () => (await api.get("/api/studio/projects")).data,
  });
  const { data: connectedRes } = useQuery({
    queryKey: ["studio-platforms"],
    queryFn: async () => (await api.get("/api/studio/platforms")).data,
  });
  const projects = projectsRes?.projects ?? [];
  const connectedSet = new Set((connectedRes?.platforms ?? []).map((p) => p.platform));

  const editorExtensions = useMemo(
    () => [
      StarterKit.configure({ link: { openOnClick: false } }),
      Placeholder.configure({ placeholder: "Your draft will stream here…" }),
    ],
    []
  );

  const editor = useEditor({
    extensions: editorExtensions,
    content: "",
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none min-h-[360px] px-3 py-3 focus:outline-none text-slate-800 [&_h1]:text-xl [&_h2]:text-lg [&_h3]:text-base",
      },
    },
  });

  const wc = editor ? wordCountFromHtml(editor.getHTML()) : 0;
  const rt = readingTime(wc);
  const limit = usage?.monthlyBlogLimit;
  const used = usage?.monthlyBlogsUsed ?? 0;
  const quotaLabel = limit != null ? `${used} of ${limit} blogs used` : `${used} blogs used`;

  const loadPost = useCallback(
    async (id) => {
      const { data } = await api.get(`/api/studio/blog/${id}`);
      const p = data.post;
      setPostId(p._id);
      setTitle(p.title || "");
      setTopic(p.title || "");
      setKeywords(p.keywords || []);
      setTone(p.tone || "professional");
      setTargetAudience(p.targetAudience || "");
      setMetaDescription(p.metaDescription || "");
      setHashtags(p.hashtags || []);
      setTitleSuggestions(p.titleSuggestions || []);
      setSocialSnippets(p.socialSnippets || { linkedin: "", twitter: "" });
      setSeoScore(p.seoScore ?? null);
      setStatus(p.status || "draft");
      setScheduledFor(toDatetimeLocalValue(p.scheduledFor));
      setPublishError(p.publishError || "");
      setPublishedLinks(p.publishedPlatforms || []);
      if (p.projectId?._id) setProjectId(p.projectId._id);
      else if (p.projectId) setProjectId(p.projectId);
      const body = p.content || "";
      if (body.trim().startsWith("<")) {
        editor?.commands.setContent(body);
      } else {
        const paras = body.split(/\n\n+/).filter(Boolean);
        editor?.commands.setContent({
          type: "doc",
          content:
            paras.length > 0
              ? paras.map((t) => ({
                  type: "paragraph",
                  content: [{ type: "text", text: t.replace(/\n/g, " ") }],
                }))
              : [{ type: "paragraph" }],
        });
      }
    },
    [editor]
  );

  useEffect(() => {
    const id = searchParams.get("post") || location.state?.postId;
    if (id) loadPost(id);
  }, [searchParams, location.state?.postId, loadPost]);

  useEffect(() => {
    const proj = projects.find((p) => p._id === projectId);
    if (proj?.brandVoice) setBrandVoice(proj.brandVoice);
  }, [projectId, projects]);

  const togglePlatform = (id) => {
    setSelectedPlatforms((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const addKeyword = (raw) => {
    const parts = raw
      .split(/[,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!parts.length) return;
    setKeywords((k) => [...new Set([...k, ...parts])]);
    setKwInput("");
  };

  const saveDraft = async () => {
    if (!projectId) {
      toast.error("Select a project");
      return false;
    }
    const html = editor?.getHTML() ?? "";
    const plain = editor?.getText() ?? "";
    try {
      const { data } = await api.post("/api/studio/blog/save", {
        id: postId,
        projectId,
        title: title || topic || "Untitled",
        content: plain || html,
        keywords,
        tone,
        targetAudience,
        metaDescription,
        hashtags,
        titleSuggestions,
        socialSnippets,
        scheduledFor: scheduledFor || null,
      });
      const p = data.post;
      setPostId(p._id);
      setLastSaved(new Date());
      queryClient.invalidateQueries({ queryKey: ["studio-drafts"] });
      toast.success("Saved");
      return true;
    } catch (e) {
      toast.error(e?.response?.data?.error || e.message);
      return false;
    }
  };

  const runGenerate = async () => {
    if (!projectId || !topic.trim()) {
      toast.error("Project and topic are required");
      return;
    }
    editor?.commands.clearContent();
    setStreaming(true);
    setTitleSuggestions([]);
    setSeoScore(null);
    setHashtags([]);
    setMetaDescription("");
    setSocialSnippets({ linkedin: "", twitter: "" });

    const token = getToken();
    const url = `${API_BASE || ""}/api/studio/blog/generate`;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          projectId,
          topic: topic.trim(),
          keywords,
          tone,
          targetAudience,
          wordCount: wordCountTarget,
          brandVoice,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || res.statusText);
      }
      const reader = res.body?.getReader();
      if (!reader) throw new Error("No stream");
      const decoder = new TextDecoder();
      let buf = "";
      let newPostId = null;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (raw === "[DONE]") continue;
          try {
            const j = JSON.parse(raw);
            if (j.text) editor?.commands.insertContent(j.text);
            if (j.postId) newPostId = j.postId;
            if (j.error) throw new Error(j.error);
          } catch (e) {
            if (e instanceof SyntaxError) continue;
            throw e;
          }
        }
      }
      if (newPostId) {
        setPostId(newPostId);
        setTitle(topic.trim());
        queryClient.invalidateQueries({ queryKey: ["studio-usage"] });
        queryClient.invalidateQueries({ queryKey: ["studio-drafts"] });
        const textBody = editor?.getText() || "";
        api
          .post("/api/studio/blog/metadata", {
            postId: newPostId,
            title: topic.trim(),
            content: textBody,
          })
          .then(({ data }) => {
            setTitleSuggestions(data.titleSuggestions || []);
            setSeoScore(data.seoScore ?? null);
            setHashtags(data.hashtags || []);
            setMetaDescription(data.metaDescription || "");
            setSocialSnippets(data.socialSnippets || { linkedin: "", twitter: "" });
          })
          .catch(() => {});
        await api.post("/api/studio/blog/save", {
          id: newPostId,
          projectId,
          title: topic.trim(),
          content: textBody,
          keywords,
          tone,
          targetAudience,
        });
        setLastSaved(new Date());
      }
    } catch (e) {
      console.error(e);
      toast.error(e.message || "Generation failed");
    } finally {
      setStreaming(false);
    }
  };

  const externalSelected = selectedPlatforms.filter((p) => p !== "sentinel-studio");

  const applyPublishResponse = (data) => {
    setStatus(data.post?.status || "published");
    setPublishError(data.post?.publishError || "");
    setPublishedLinks(data.post?.publishedPlatforms || []);
    if (data.errors?.length) {
      toast.error(data.errors.map((e) => `${e.platform}: ${e.message}`).join("\n"));
    }
    if (data.post?.status === "failed") {
      toast.error(data.post.publishError || "Publish failed — check your API key on Platforms");
    } else if (data.scheduled) {
      toast.success(data.message || "Scheduled for external platforms");
      queryClient.invalidateQueries({ queryKey: ["studio-calendar-week"] });
    } else if ((data.published || []).length) {
      toast.success(`Live on: ${data.published.map((p) => p.platform).join(", ")}`);
      queryClient.invalidateQueries({ queryKey: ["studio-published"] });
    } else if ((data.queued || []).length) {
      toast.success(`Queued: ${data.queued.join(", ")}`);
    } else if (data.errors?.length) {
      /* toast already shown above */
    }
    queryClient.invalidateQueries({ queryKey: ["studio-drafts"] });
    queryClient.invalidateQueries({ queryKey: ["studio-calendar"] });
    queryClient.invalidateQueries({ queryKey: ["studio-calendar-week"] });
  };

  const publishToStudioOnly = async () => {
    if (!postId) return toast.error("Generate or save a post first");
    if (!(await saveDraft())) return;
    try {
      const { data } = await api.post("/api/studio/blog/schedule", {
        postId,
        platforms: ["sentinel-studio"],
        publishToStudio: true,
        scheduledFor: null,
      });
      applyPublishResponse(data);
    } catch (e) {
      toast.error(e?.response?.data?.error || e.message);
    }
  };

  const publishToExternalNow = async () => {
    if (!postId) return toast.error("Generate or save a post first");
    if (!externalSelected.length) {
      return toast.error("Select Dev.to, Medium, LinkedIn, etc. Connect them under Studio → Platforms first.");
    }
    const missing = externalSelected.filter((p) => !connectedSet.has(p));
    if (missing.length) {
      return toast.error(`Not connected: ${missing.join(", ")}. Go to Studio → Platforms.`);
    }
    if (!(await saveDraft())) return;
    try {
      const { data } = await api.post("/api/studio/blog/schedule", {
        postId,
        platforms: externalSelected,
        publishToStudio: false,
      });
      applyPublishResponse(data);
    } catch (e) {
      toast.error(e?.response?.data?.error || e.message);
    }
  };

  const scheduleExternal = async () => {
    if (!postId) return toast.error("Generate or save a post first");
    if (!scheduledFor) return toast.error("Pick a date and time to schedule");
    const runAt = new Date(scheduledFor);
    if (Number.isNaN(runAt.getTime()) || runAt.getTime() < Date.now() + 30_000) {
      return toast.error("Choose a time at least 30 seconds in the future");
    }
    if (!externalSelected.length) {
      return toast.error("Select platforms to schedule (Dev.to, Medium, …)");
    }
    const missing = externalSelected.filter((p) => !connectedSet.has(p));
    if (missing.length) {
      return toast.error(`Not connected: ${missing.join(", ")}`);
    }
    if (!(await saveDraft())) return;
    try {
      const { data } = await api.post("/api/studio/blog/schedule", {
        postId,
        platforms: externalSelected,
        publishToStudio: false,
        scheduledFor,
      });
      applyPublishResponse(data);
    } catch (e) {
      toast.error(e?.response?.data?.error || e.message);
    }
  };

  const seoColor = useMemo(() => {
    if (seoScore == null) return "text-slate-400";
    if (seoScore >= 70) return "text-emerald-600";
    if (seoScore >= 40) return "text-amber-600";
    return "text-red-600";
  }, [seoScore]);

  return (
    <div className="pt-6 max-w-[1400px]">
      <header className="mb-6">
        <h1 className="font-headline text-2xl font-semibold text-primary">Blogging Agent</h1>
        <p className="text-sm text-on-surface-variant mt-1">
          Generate posts, connect platforms under Studio → Platforms, then publish or schedule to Dev.to, Medium, LinkedIn, and more.
        </p>
      </header>

      <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
        <aside className="w-full xl:w-[280px] shrink-0 space-y-4 bg-white border border-surface-variant rounded-md p-4 h-fit">
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Project</label>
            <select
              className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
            >
              <option value="">— Select —</option>
              {projects.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Blog topic</label>
            <input
              className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="What should this post cover?"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Keywords</label>
            <input
              className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm"
              value={kwInput}
              onChange={(e) => setKwInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  addKeyword(kwInput);
                }
              }}
              placeholder="Type and press Enter"
            />
            <div className="flex flex-wrap gap-1 mt-2">
              {keywords.map((k) => (
                <button
                  key={k}
                  type="button"
                  className="text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-700"
                  onClick={() => setKeywords((x) => x.filter((y) => y !== k))}
                >
                  {k} ×
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-600 block mb-1">Tone</span>
            <div className="flex flex-wrap gap-1">
              {TONES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTone(t)}
                  className={`text-[10px] px-2 py-1 rounded capitalize ${
                    tone === t ? "bg-[#031634] text-white" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Target audience</label>
            <input
              className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm"
              value={targetAudience}
              onChange={(e) => setTargetAudience(e.target.value)}
              placeholder="e.g. senior engineers"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Word count: {wordCountTarget}</label>
            <input
              type="range"
              min={500}
              max={3000}
              step={250}
              value={wordCountTarget}
              onChange={(e) => setWordCountTarget(Number(e.target.value))}
              className="w-full"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Brand voice</label>
            <textarea
              className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm min-h-[72px]"
              value={brandVoice}
              onChange={(e) => setBrandVoice(e.target.value)}
            />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-600 block mb-1">Publish to</span>
            <div className="space-y-1">
              {PLATFORMS.map((p) => (
                <label key={p.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedPlatforms.includes(p.id)}
                    onChange={() => togglePlatform(p.id)}
                  />
                  <span>
                    {p.label}
                    {p.id !== "sentinel-studio" && (
                      <span
                        className={`ml-1 text-[9px] font-bold ${
                          connectedSet.has(p.id) ? "text-emerald-600" : "text-amber-600"
                        }`}
                      >
                        {connectedSet.has(p.id) ? "✓" : "connect"}
                      </span>
                    )}
                  </span>
                </label>
              ))}
            </div>
            <Link to="/studio/platforms" className="text-[10px] text-secondary hover:underline mt-1 inline-block">
              Manage platform API keys →
            </Link>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Schedule publish</label>
            <input
              type="datetime-local"
              className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm"
              value={scheduledFor}
              onChange={(e) => setScheduledFor(e.target.value)}
            />
            <p className="text-[10px] text-slate-500 mt-1">Used with “Schedule to platforms” below</p>
          </div>
          <p className="text-[11px] text-slate-500">{quotaLabel}</p>
          <button
            type="button"
            disabled={streaming || !projectId || !topic.trim()}
            onClick={runGenerate}
            className="w-full py-2.5 rounded-md bg-[#031634] text-white text-sm font-semibold disabled:opacity-40"
          >
            {streaming ? "Generating…" : "Generate"}
          </button>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={publishToExternalNow}
              className="w-full py-2.5 text-sm font-semibold rounded-md bg-[#031634] text-white hover:opacity-90"
            >
              Publish now (Dev.to / Medium / …)
            </button>
            <button
              type="button"
              onClick={scheduleExternal}
              className="w-full py-2 text-sm font-semibold border-2 border-[#031634] text-[#031634] rounded-md hover:bg-slate-50"
            >
              Schedule to platforms
            </button>
            <button
              type="button"
              onClick={publishToStudioOnly}
              className="w-full py-2 text-sm border border-slate-200 rounded-md hover:bg-slate-50"
            >
              Save to Studio only
            </button>
            <button type="button" onClick={saveDraft} className="w-full py-2 text-xs text-slate-600 hover:underline">
              Save draft
            </button>
            <Link to="/studio/published" className="text-center text-xs font-semibold text-secondary hover:underline">
              View Published →
            </Link>
            <Link to="/studio/calendar" className="text-center text-xs text-slate-500 hover:underline">
              Calendar (scheduled) →
            </Link>
          </div>
        </aside>

        <div className="flex-1 min-w-0 bg-white border border-surface-variant rounded-md overflow-hidden">
          <div className="border-b border-slate-100 px-3 py-2 flex flex-wrap gap-1 bg-slate-50">
            {editor && (
              <>
                <ToolbarBtn onClick={() => editor.chain().focus().toggleBold().run()} label="Bold" icon="format_bold" active={editor.isActive("bold")} />
                <ToolbarBtn onClick={() => editor.chain().focus().toggleItalic().run()} label="Italic" icon="format_italic" active={editor.isActive("italic")} />
                <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} label="H1" icon="title" active={editor.isActive("heading", { level: 1 })} />
                <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} label="H2" icon="title" active={editor.isActive("heading", { level: 2 })} />
                <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} label="H3" icon="title" active={editor.isActive("heading", { level: 3 })} />
                <ToolbarBtn onClick={() => editor.chain().focus().toggleBlockquote().run()} label="Quote" icon="format_quote" active={editor.isActive("blockquote")} />
                <ToolbarBtn onClick={() => editor.chain().focus().toggleCodeBlock().run()} label="Code" icon="code" active={editor.isActive("codeBlock")} />
                <ToolbarBtn onClick={() => editor.chain().focus().toggleBulletList().run()} label="UL" icon="format_list_bulleted" active={editor.isActive("bulletList")} />
                <ToolbarBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} label="OL" icon="format_list_numbered" active={editor.isActive("orderedList")} />
                <ToolbarBtn
                  onClick={() => {
                    const u = window.prompt("Link URL");
                    if (u) editor.chain().focus().extendMarkRange("link").setLink({ href: u }).run();
                  }}
                  label="Link"
                  icon="link"
                  active={editor.isActive("link")}
                />
              </>
            )}
          </div>
          <div className="px-3 pt-3">
            <label className="text-xs font-semibold text-slate-500">Title</label>
            <input
              className="w-full text-lg font-semibold border-0 border-b border-slate-200 focus:ring-0 focus:border-secondary mb-2"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Post title"
            />
          </div>
          <div className={`relative ${streaming ? "animate-pulse" : ""}`}>
            <EditorContent editor={editor} />
            {streaming && (
              <span className="absolute bottom-4 right-4 text-xs text-secondary font-medium motion-safe:animate-pulse">Streaming…</span>
            )}
          </div>
          <div className="border-t border-slate-100 px-3 py-2 flex flex-wrap gap-3 text-xs text-slate-600 bg-slate-50">
            <span>{wc} words</span>
            <span>{rt} min read</span>
            <span>{lastSaved ? `Saved ${lastSaved.toLocaleTimeString()}` : "Not saved"}</span>
            <span
              className={`uppercase font-semibold ${
                status === "published" ? "text-emerald-700" : status === "failed" ? "text-rose-600" : "text-slate-500"
              }`}
            >
              {status}
            </span>
          </div>
          {(publishError || publishedLinks.length > 0) && (
            <div className="border-t border-slate-100 px-3 py-2 text-xs bg-amber-50/80">
              {publishedLinks.map((pp, i) => (
                <div key={i} className="text-slate-700">
                  <span className="font-semibold">{pp.platform}:</span>{" "}
                  {pp.url ? (
                    <a href={pp.url} className="text-secondary hover:underline" target="_blank" rel="noreferrer">
                      {pp.platform === "sentinel-studio" ? "Open post" : pp.url}
                    </a>
                  ) : (
                    "pending"
                  )}
                </div>
              ))}
              {publishError && <p className="text-rose-700 mt-1">{publishError}</p>}
            </div>
          )}
        </div>

        <aside className="w-full xl:w-[260px] shrink-0 space-y-5 bg-white border border-surface-variant rounded-md p-4 h-fit">
          <section>
            <h3 className="text-xs font-semibold uppercase text-slate-500 mb-2">Title suggestions</h3>
            <ul className="space-y-1">
              {titleSuggestions.map((s, i) => (
                <li key={i}>
                  <button type="button" className="text-left text-xs text-secondary hover:underline" onClick={() => setTitle(s)}>
                    {s}
                  </button>
                </li>
              ))}
              {!titleSuggestions.length && <p className="text-xs text-slate-400">Generate to populate</p>}
            </ul>
          </section>
          <section>
            <h3 className="text-xs font-semibold uppercase text-slate-500 mb-2">SEO score</h3>
            <div className={`flex items-center justify-center w-20 h-20 rounded-full border-4 border-slate-200 mx-auto ${seoColor}`}>
              <span className="text-xl font-bold">{seoScore ?? "—"}</span>
            </div>
          </section>
          <section>
            <h3 className="text-xs font-semibold uppercase text-slate-500 mb-2">Hashtags</h3>
            <div className="flex flex-wrap gap-1">
              {hashtags.map((h) => (
                <button key={h} type="button" onClick={() => navigator.clipboard?.writeText(h)} className="text-[10px] px-2 py-0.5 rounded bg-slate-100">
                  {h}
                </button>
              ))}
            </div>
          </section>
          <section>
            <h3 className="text-xs font-semibold uppercase text-slate-500 mb-2">Meta description</h3>
            <textarea
              className="w-full text-xs border border-slate-200 rounded-md p-2 min-h-[72px]"
              maxLength={160}
              value={metaDescription}
              onChange={(e) => setMetaDescription(e.target.value)}
            />
            <p className="text-[10px] text-slate-400 text-right">{metaDescription.length}/160</p>
          </section>
          <section>
            <h3 className="text-xs font-semibold uppercase text-slate-500 mb-2">Social snippets</h3>
            <div className="flex gap-1 mb-2">
              {["linkedin", "twitter"].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setSocialTab(t)}
                  className={`text-[10px] px-2 py-1 rounded capitalize ${socialTab === t ? "bg-slate-900 text-white" : "bg-slate-100"}`}
                >
                  {t}
                </button>
              ))}
            </div>
            <AnimatePresence mode="wait">
              <motion.p
                key={socialTab}
                initial={{ opacity: 0, x: socialTab === "linkedin" ? -8 : 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="text-xs text-slate-700 whitespace-pre-wrap"
              >
                {socialSnippets[socialTab] || "—"}
              </motion.p>
            </AnimatePresence>
            <button
              type="button"
              className="mt-2 text-xs text-secondary hover:underline"
              onClick={() => navigator.clipboard?.writeText(socialSnippets[socialTab] || "")}
            >
              Copy
            </button>
          </section>
        </aside>
      </div>
    </div>
  );
}

function ToolbarBtn({ onClick, label, icon, active }) {
  return (
    <button
      type="button"
      title={label}
      onClick={onClick}
      className={`p-1.5 rounded ${active ? "bg-slate-200" : "hover:bg-slate-100"}`}
    >
      <span className="material-symbols-outlined text-[18px] text-slate-700">{icon}</span>
    </button>
  );
}
