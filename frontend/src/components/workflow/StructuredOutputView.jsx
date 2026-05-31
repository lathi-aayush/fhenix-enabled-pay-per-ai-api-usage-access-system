import React from "react";
import { mediaSrc } from "../../utils/mediaUrl.js";
import AudioPlayerBlock from "../shared/AudioPlayerBlock.jsx";

function tryParseJson(text) {
  const raw = String(text || "").trim();
  if (!raw) return null;
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : raw;
  if (!candidate.startsWith("{") && !candidate.startsWith("[")) return null;
  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
}

function MarkdownSections({ text }) {
  const blocks = String(text || "")
    .split(/\n(?=## )/g)
    .filter(Boolean);

  if (blocks.length <= 1 && !text?.includes("## ")) {
    return <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">{text}</p>;
  }

  return (
    <div className="space-y-3">
      {blocks.map((block, i) => {
        const lines = block.trim().split("\n");
        const title = lines[0].replace(/^#+\s*/, "");
        const body = lines.slice(1).join("\n").trim();
        const bullets = body
          .split("\n")
          .filter((l) => /^[-*]\s/.test(l.trim()))
          .map((l) => l.replace(/^[-*]\s+/, ""));

        return (
          <section key={i} className="rounded-md bg-white border border-slate-100 p-2.5">
            <h4 className="text-[11px] font-bold text-primary uppercase tracking-wide mb-1.5">{title}</h4>
            {bullets.length > 0 ? (
              <ul className="list-disc list-inside text-xs text-slate-700 space-y-0.5">
                {bullets.map((b, j) => (
                  <li key={j}>{b}</li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">{body}</p>
            )}
          </section>
        );
      })}
    </div>
  );
}

function JsonStructured({ data }) {
  if (!data || typeof data !== "object") return null;
  return (
    <div className="space-y-3">
      {data.title && (
        <h3 className="text-base font-bold text-primary leading-snug">{data.title}</h3>
      )}
      {data.summary && (
        <section className="rounded-md bg-white border border-slate-100 p-2.5">
          <h4 className="text-[10px] font-bold text-slate-500 uppercase mb-1">Summary</h4>
          {String(data.summary).includes("## ") ? (
            <MarkdownSections text={data.summary} />
          ) : (
            <p className="text-xs text-slate-700 leading-relaxed">{data.summary}</p>
          )}
        </section>
      )}
      {Array.isArray(data.keyPoints) && data.keyPoints.length > 0 && (
        <section className="rounded-md bg-white border border-slate-100 p-2.5">
          <h4 className="text-[10px] font-bold text-slate-500 uppercase mb-1">Key points</h4>
          <ul className="list-disc list-inside text-xs text-slate-700 space-y-0.5">
            {data.keyPoints.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </section>
      )}
      {Array.isArray(data.takeaways) && data.takeaways.length > 0 && (
        <section className="rounded-md bg-emerald-50 border border-emerald-100 p-2.5">
          <h4 className="text-[10px] font-bold text-emerald-800 uppercase mb-1">Takeaways</h4>
          <ul className="list-disc list-inside text-xs text-emerald-900 space-y-0.5">
            {data.takeaways.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </section>
      )}
      {data.blog?.blogPostId && (
        <section className="rounded-md bg-indigo-50 border border-indigo-100 p-2.5 space-y-1">
          <h4 className="text-[10px] font-bold text-indigo-900 uppercase">Blog post</h4>
          <p className="text-xs font-semibold text-primary">{data.blog.title}</p>
          <p className="text-[10px] text-indigo-800">
            Status: {data.blog.status} · {data.blog.wordCount} words
          </p>
          {data.blog.scheduled && data.blog.scheduledFor && (
            <p className="text-[10px] text-amber-800">
              Scheduled: {new Date(data.blog.scheduledFor).toLocaleString()}
              {data.blog.scheduledPlatforms?.length
                ? ` → ${data.blog.scheduledPlatforms.join(", ")}`
                : ""}
            </p>
          )}
          {data.blog.queuedPlatforms?.length > 0 && (
            <p className="text-[10px] text-indigo-700">
              Queued: {data.blog.queuedPlatforms.join(", ")}
            </p>
          )}
        </section>
      )}
      {data.details && (
        <section className="rounded-md bg-white border border-slate-100 p-2.5">
          <h4 className="text-[10px] font-bold text-slate-500 uppercase mb-1">Details</h4>
          <p className="text-xs text-slate-600 whitespace-pre-wrap">{data.details}</p>
        </section>
      )}
      {mediaSrc(data.image) && (
        <section className="rounded-md bg-white border border-slate-100 p-2.5">
          <h4 className="text-[10px] font-bold text-slate-500 uppercase mb-2">Image</h4>
          <img
            src={mediaSrc(data.image)}
            alt="Generated"
            className="w-full rounded-md aspect-video object-cover"
          />
        </section>
      )}
      {data.prompt && !mediaSrc(data.image) && (
        <section className="rounded-md bg-white border border-slate-100 p-2.5 max-h-40 overflow-y-auto">
          <h4 className="text-[10px] font-bold text-slate-500 uppercase mb-1">Prompt</h4>
          <p className="text-xs text-slate-600 whitespace-pre-wrap">{String(data.prompt).slice(0, 1200)}</p>
        </section>
      )}
      {Array.isArray(data.images) && data.images.length > 0 && (
        <section className="rounded-md bg-white border border-slate-100 p-2.5">
          <h4 className="text-[10px] font-bold text-slate-500 uppercase mb-2">Keyframes</h4>
          <div className="flex flex-wrap gap-2">
            {data.images.map((img, i) => {
              const src = mediaSrc(img);
              return src ? (
                <img
                  key={i}
                  src={src}
                  alt={`Keyframe ${i + 1}`}
                  className="w-32 aspect-video object-cover rounded-md border border-slate-200"
                />
              ) : null;
            })}
          </div>
        </section>
      )}
      {mediaSrc(data.audio) && <AudioPlayerBlock audio={data.audio} />}
      {data.videoUri && (
        <section className="rounded-md bg-white border border-slate-100 p-2.5">
          <h4 className="text-[10px] font-bold text-slate-500 uppercase mb-1">Video</h4>
          {String(data.videoUri).startsWith("http") ? (
            <video controls className="w-full rounded-md" src={mediaSrc(data.videoUri)} />
          ) : (
            <p className="text-xs font-mono text-slate-600 break-all">{data.videoUri}</p>
          )}
        </section>
      )}
      {data.text && typeof data.text === "string" && (
        <section className="rounded-md bg-white border border-slate-100 p-2.5 max-h-48 overflow-y-auto">
          <h4 className="text-[10px] font-bold text-slate-500 uppercase mb-1">Script</h4>
          <pre className="text-xs text-slate-700 whitespace-pre-wrap">{data.text.slice(0, 4000)}</pre>
        </section>
      )}
    </div>
  );
}

/** Render workflow structuredResult or parsed node output */
export function StructuredOutputView({ structuredResult, fallbackText }) {
  const payload = structuredResult || tryParseJson(fallbackText);
  if (!payload) {
    return <MarkdownSections text={fallbackText} />;
  }

  if (payload.final || payload.steps) {
    return (
      <div className="space-y-3">
        {payload.workflowName && (
          <p className="text-[10px] text-slate-500 font-medium">{payload.workflowName}</p>
        )}
        {payload.final && typeof payload.final === "object" ? (
          <JsonStructured data={payload.final} />
        ) : payload.final?.summary ? (
          <JsonStructured data={payload.final} />
        ) : typeof payload.final === "string" ? (
          <MarkdownSections text={payload.final} />
        ) : null}
        {!payload.final && payload.steps?.length > 0 && (
          <JsonStructured data={payload.steps[payload.steps.length - 1]?.structured || { summary: payload.steps[payload.steps.length - 1]?.text }} />
        )}
      </div>
    );
  }

  return <JsonStructured data={payload} />;
}

function parseCreativeOutput(output) {
  const parsed = tryParseJson(output);
  if (parsed?.kind === "imageGen" || parsed?.kind === "promptGen") return parsed;
  if (typeof parsed?.kind === "string" && parsed.kind.startsWith("agentic")) return parsed;
  return parsed;
}

export function NodeOutputPreview({ output, label, type, status, expanded, onToggle }) {
  const parsed = parseCreativeOutput(output);
  const isLong = String(output || "").length > 280;

  return (
    <div className="rounded-lg border border-surface-variant overflow-hidden bg-slate-50">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-slate-100"
      >
        <div>
          <span className="text-xs font-semibold text-primary">{label}</span>
          <span className="ml-2 text-[9px] uppercase text-slate-400">{type}</span>
        </div>
        <span className="text-[9px] font-bold uppercase text-secondary">{status}</span>
      </button>
      {expanded && (
        <div className="px-3 pb-3 border-t border-surface-variant bg-white">
          {parsed?.kind === "imageGen" && mediaSrc(parsed.image) ? (
            <div className="space-y-2">
              <img
                src={mediaSrc(parsed.image)}
                alt="Generated"
                className="w-full rounded-md aspect-video object-cover"
              />
              {parsed.imageWarning && (
                <p className="text-[10px] text-amber-700">{parsed.imageWarning}</p>
              )}
            </div>
          ) : parsed?.kind === "promptGen" && parsed.prompt ? (
            <MarkdownSections text={parsed.prompt} />
          ) : parsed?.kind?.startsWith("agentic") ? (
            <div className="space-y-2">
              {parsed.kind === "agenticText" && parsed.content && (
                <MarkdownSections text={String(parsed.content).slice(0, 3000)} />
              )}
              {parsed.kind === "agenticImage" && Array.isArray(parsed.images) && (
                <div className="flex flex-wrap gap-2">
                  {parsed.images.map((img, i) => {
                    const src = mediaSrc(img);
                    return src ? (
                      <img
                        key={i}
                        src={src}
                        alt=""
                        className="w-full max-w-[200px] aspect-video object-cover rounded-md"
                      />
                    ) : null;
                  })}
                </div>
              )}
              {parsed.kind === "agenticAudio" && (
                <>
                  {mediaSrc(parsed.audio) ? (
                    <AudioPlayerBlock audio={parsed.audio} className="border-0 p-0" />
                  ) : typeof parsed.content === "string" &&
                    (parsed.content.startsWith("/outputs/") ||
                      parsed.content.startsWith("http")) ? (
                    <AudioPlayerBlock
                      audio={{ mimeType: "audio/wav", url: parsed.content }}
                      className="border-0 p-0"
                    />
                  ) : (
                    <p className="text-[10px] text-slate-600">
                      {parsed.displayPreview || "No playable audio URL — re-run after backend deploy."}
                    </p>
                  )}
                </>
              )}
              {parsed.kind === "agenticVideo" && (
                <div className="text-[10px] text-slate-600 space-y-2">
                  {parsed.videoUri && String(parsed.videoUri).startsWith("http") ? (
                    <video controls className="w-full rounded-md" src={mediaSrc(parsed.videoUri)} />
                  ) : parsed.videoUri?.startsWith("gs://") ? (
                    <p className="text-xs font-mono break-all">{parsed.videoUri}</p>
                  ) : null}
                  {(parsed.videoNote || parsed.meta?.reason || parsed.meta?.error) && (
                    <p className="text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1.5 leading-relaxed">
                      {parsed.videoNote || parsed.meta?.reason || parsed.meta?.error}
                    </p>
                  )}
                  {!parsed.videoUri && !parsed.videoNote && !parsed.meta?.reason && (
                    <p>{parsed.displayPreview || "Video step"}</p>
                  )}
                </div>
              )}
              {parsed.kind === "agenticCode" && (
                <pre className="text-[10px] whitespace-pre-wrap">{parsed.content || parsed.code}</pre>
              )}
              {parsed.imageWarning && (
                <p className="text-[10px] text-amber-700">{parsed.imageWarning}</p>
              )}
              {parsed.audioWarning && (
                <p className="text-[10px] text-amber-700">{parsed.audioWarning}</p>
              )}
            </div>
          ) : parsed && (parsed.summary || parsed.keyPoints) ? (
            <JsonStructured data={parsed} />
          ) : String(output || "").includes("## ") ? (
            <MarkdownSections text={output} />
          ) : (
            <pre className="text-[10px] text-slate-600 whitespace-pre-wrap font-mono max-h-48 overflow-y-auto">
              {output}
            </pre>
          )}
        </div>
      )}
      {!expanded && isLong && (
        <p className="px-3 pb-2 text-[10px] text-slate-500 truncate">{String(output).slice(0, 120)}…</p>
      )}
    </div>
  );
}
