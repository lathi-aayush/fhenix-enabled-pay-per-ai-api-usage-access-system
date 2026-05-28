import React from "react";

function scoreColors(n) {
  if (n >= 75) return { text: "text-emerald-600", bar: "bg-emerald-600" };
  if (n >= 50) return { text: "text-amber-600", bar: "bg-amber-600" };
  return { text: "text-red-600", bar: "bg-red-600" };
}

function ScoreBar({ label, score }) {
  const pct = Math.min(100, Math.max(0, Number(score) || 0));
  const { text, bar } = scoreColors(pct);
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="font-semibold text-slate-600">{label}</span>
        <span className={`font-mono font-semibold ${text}`}>{pct}%</span>
      </div>
      <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
        <div className={`h-full transition-all duration-300 ${bar}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function PromptAnalyzer({ analysis, analyzing }) {
  if (analyzing) {
    return (
      <div className="bg-white border border-surface-variant rounded-md p-4 mb-4">
        <p className="text-sm animate-pulse text-on-surface-variant">Analyzing prompt quality…</p>
      </div>
    );
  }

  if (!analysis) return null;

  return (
    <div className="bg-white border border-surface-variant rounded-md p-4 mb-4 space-y-4">
      <h3 className="text-sm font-semibold text-primary">Prompt analyzer</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <ScoreBar label="Quality" score={analysis.qualityScore} />
        <ScoreBar label="Clarity" score={analysis.clarityScore} />
      </div>
      {analysis.structureFeedback && (
        <p className="text-xs text-on-surface-variant leading-relaxed">{analysis.structureFeedback}</p>
      )}
      {analysis.suggestions?.length > 0 && (
        <ul className="space-y-1">
          {analysis.suggestions.map((s, i) => (
            <li
              key={i}
              className="text-[11px] px-2 py-1 rounded bg-slate-100 text-slate-700 border border-slate-100"
            >
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
