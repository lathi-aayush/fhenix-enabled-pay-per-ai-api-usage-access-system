import React from "react";
import PromptToolbar from "./PromptToolbar.jsx";

/** Minimal safe markdown-ish rendering without extra deps */
function renderMarkdown(text) {
  if (!text) return null;
  const lines = text.split("\n");
  return lines.map((line, i) => {
    if (line.startsWith("## ")) {
      return (
        <h3 key={i} className="font-headline text-base font-semibold text-primary mt-4 mb-2">
          {line.slice(3)}
        </h3>
      );
    }
    if (line.startsWith("# ")) {
      return (
        <h2 key={i} className="font-headline text-lg font-semibold text-primary mt-4 mb-2">
          {line.slice(2)}
        </h2>
      );
    }
    if (line.startsWith("- ")) {
      return (
        <li key={i} className="text-sm text-slate-700 ml-4 list-disc">
          {line.slice(2)}
        </li>
      );
    }
    if (!line.trim()) return <br key={i} />;
    const bold = line.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    return (
      <p
        key={i}
        className="text-sm text-slate-700 leading-relaxed mb-2"
        dangerouslySetInnerHTML={{ __html: bold }}
      />
    );
  });
}

export default function PromptOutput({
  title,
  output,
  streaming,
  loading,
  error,
  onRetry,
  toolbar,
  emptyHint,
}) {
  const hasOutput = Boolean(output?.trim());

  return (
    <div className="flex-1 min-w-0">
      {title && <h2 className="text-sm font-semibold text-primary mb-3">{title}</h2>}
      {toolbar}
      {error && (
        <div className="mb-4 px-4 py-3 rounded-md bg-rose-50 border border-rose-100 text-sm text-rose-800 flex flex-wrap justify-between gap-2">
          <span>{error}</span>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="text-xs font-semibold text-rose-900 underline"
            >
              Retry
            </button>
          )}
        </div>
      )}
      <div className="bg-white border border-surface-variant rounded-md min-h-[320px] flex flex-col">
        <div className="flex-1 p-4 overflow-auto max-h-[70vh]">
          {loading && !hasOutput && (
            <p className="text-sm animate-pulse text-on-surface-variant">Generating…</p>
          )}
          {!loading && !hasOutput && (
            <p className="text-sm text-on-surface-variant">{emptyHint}</p>
          )}
          {hasOutput && (
            <div className="prose-sm max-w-none">
              {renderMarkdown(output)}
              {streaming && (
                <span className="inline-block w-2 h-4 ml-0.5 bg-[#031634] animate-pulse align-middle" />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function PromptOutputWithToolbar(props) {
  const { output, loading, streaming, error, onRetry, handlers, analyzing, toolbarVariant, workflowLoading } =
    props;
  const disabled = !output?.trim();

  return (
    <PromptOutput
      title={props.title}
      output={output}
      streaming={streaming}
      loading={loading}
      error={error}
      onRetry={onRetry}
      emptyHint={props.emptyHint}
      toolbar={
        <PromptToolbar
          variant={toolbarVariant}
          disabled={disabled}
          loading={loading || workflowLoading}
          analyzing={analyzing}
          onCopy={handlers.onCopy}
          onRegenerate={handlers.onRegenerate}
          onVariations={handlers.onVariations}
          onImprove={handlers.onImprove}
          onDownload={handlers.onDownload}
          onAnalyze={handlers.onAnalyze}
          onWorkflowToImage={handlers.onWorkflowToImage}
        />
      }
    />
  );
}
