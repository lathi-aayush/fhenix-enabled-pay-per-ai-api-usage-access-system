import React from "react";

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
        <h3 className="text-sm font-bold text-primary">{data.title}</h3>
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

export function NodeOutputPreview({ output, label, type, status, expanded, onToggle }) {
  const parsed = tryParseJson(output);
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
          {parsed && (parsed.summary || parsed.keyPoints) ? (
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
