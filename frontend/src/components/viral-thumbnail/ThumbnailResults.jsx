import React from "react";
import GlassCard, { ScoreBar, ShimmerBlock } from "./GlassCard.jsx";
import ThinkingState from "./ThinkingState.jsx";

function CopyBtn({ text, label = "Copy" }) {
  return (
    <button
      type="button"
      onClick={() => navigator.clipboard.writeText(text)}
      className="text-[11px] font-semibold px-2 py-1 rounded border border-surface-variant hover:bg-slate-50"
    >
      {label}
    </button>
  );
}

function TextBlock({ children }) {
  return <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{children}</p>;
}

function downloadDataUrl(dataUrl, filename) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

function ThumbnailImagePreview({ src, alt, className = "" }) {
  if (!src) return null;
  return (
    <div className={`relative rounded-md overflow-hidden border border-slate-200 bg-slate-900/5 ${className}`}>
      <img src={src} alt={alt} className="w-full aspect-video object-cover" />
    </div>
  );
}

export default function ThumbnailResults({
  result,
  loading,
  imageLoading,
  onRegenerateMainImage,
  onDownloadMainImage,
  onRegenerateVariations,
  variationsLoading,
}) {
  if (loading && !result) return <ThinkingState longRunning={loading} />;

  if (!result) {
    return (
      <div className="rounded-md border border-dashed border-surface-variant p-12 text-center text-sm text-on-surface-variant">
        Configure your video and click Generate to get a viral thumbnail image plus strategy cards.
      </div>
    );
  }

  const c = result.concept || {};
  const tt = result.thumbnailText || {};
  const ctr = result.ctrAnalysis || {};
  const cs = result.colorStrategy || {};
  const mainImage = result.images?.main;
  const variationRows = (result.variations || []).map((v, i) => ({
    ...v,
    image: result.images?.variations?.[i]?.image,
    imageError: result.images?.variations?.[i]?.imageError,
  }));

  return (
    <div className="space-y-4">
      <GlassCard
        title="Generated thumbnail"
        icon="photo"
        delay={0}
        actions={
          mainImage?.dataUrl ? (
            <div className="flex gap-1">
              <button
                type="button"
                onClick={onDownloadMainImage}
                className="text-[11px] font-semibold px-2 py-1 rounded border border-surface-variant hover:bg-slate-50"
              >
                Download
              </button>
              <button
                type="button"
                disabled={imageLoading}
                onClick={onRegenerateMainImage}
                className="text-[11px] font-semibold px-2 py-1 rounded border border-surface-variant hover:bg-slate-50 disabled:opacity-50"
              >
                {imageLoading ? "Rendering…" : "Regenerate image"}
              </button>
            </div>
          ) : null
        }
      >
        {imageLoading && !mainImage?.dataUrl ? (
          <ShimmerBlock className="aspect-video w-full" />
        ) : mainImage?.dataUrl ? (
          <ThumbnailImagePreview src={mainImage.dataUrl} alt="Generated viral thumbnail" />
        ) : (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {result.imageWarning ||
              "Image preview could not be generated. Strategy and prompts are still available below."}
            {onRegenerateMainImage && (
              <button
                type="button"
                disabled={imageLoading}
                onClick={onRegenerateMainImage}
                className="block mt-2 text-xs font-semibold underline disabled:opacity-50"
              >
                Try generating image again
              </button>
            )}
          </div>
        )}
        {tt.mainHook && mainImage?.dataUrl && (
          <p className="text-xs text-on-surface-variant mt-2 text-center">Hook: {tt.mainHook}</p>
        )}
      </GlassCard>

      <GlassCard title="Thumbnail concept" icon="lightbulb" delay={0.05}>
        <TextBlock>{c.main}</TextBlock>
        <ul className="mt-3 space-y-1 text-xs text-slate-600">
          <li>
            <span className="font-semibold">Scene:</span> {c.scene}
          </li>
          <li>
            <span className="font-semibold">Subject:</span> {c.subjectPlacement}
          </li>
          <li>
            <span className="font-semibold">Background:</span> {c.background}
          </li>
        </ul>
      </GlassCard>

      <GlassCard title="Thumbnail hook text" icon="title" delay={0.1}>
        <p className="text-xl font-headline font-bold text-[#031634] mb-2">{tt.mainHook}</p>
        <p className="text-[11px] text-on-surface-variant mb-2">{tt.typographyNotes}</p>
        <div className="flex flex-wrap gap-2">
          {(tt.alternatives || []).map((alt, i) => (
            <span
              key={i}
              className="text-xs px-2 py-1 rounded bg-slate-100 border border-slate-200 font-semibold text-slate-800"
            >
              {alt}
            </span>
          ))}
        </div>
      </GlassCard>

      <GlassCard title="CTR analysis" icon="analytics" delay={0.15}>
        <ScoreBar label="CTR potential" value={ctr.ctrScore} />
        <ScoreBar label="Emotional intensity" value={ctr.emotionalIntensity} />
        <ScoreBar label="Curiosity" value={ctr.curiosityScore} />
        <ScoreBar label="Attention" value={ctr.attentionScore} />
        <ScoreBar label="Mobile readability" value={ctr.mobileReadability} />
        <p className="text-xs text-on-surface-variant mt-3">{ctr.summary}</p>
      </GlassCard>

      <div className="grid gap-4 md:grid-cols-2">
        <GlassCard title="Emotional strategy" icon="psychology" delay={0.2}>
          <TextBlock>{result.emotionalStrategy}</TextBlock>
        </GlassCard>
        <GlassCard title="Composition layout" icon="grid_view" delay={0.22}>
          <TextBlock>{result.compositionLayout}</TextBlock>
        </GlassCard>
      </div>

      <GlassCard title="Color strategy" icon="palette" delay={0.25}>
        <div className="flex flex-wrap gap-2 mb-3">
          {(cs.palette || []).map((col, i) => (
            <span
              key={i}
              className="text-[11px] px-2 py-1 rounded-full bg-gradient-to-r from-slate-100 to-slate-200 border border-slate-200"
            >
              {col}
            </span>
          ))}
        </div>
        <TextBlock>
          <strong>Contrast:</strong> {cs.contrast}
          {"\n\n"}
          <strong>Reasoning:</strong> {cs.reasoning}
        </TextBlock>
        <p className="text-xs text-on-surface-variant mt-2">{result.colorPsychology}</p>
      </GlassCard>

      <GlassCard
        title="Cinematic image prompt"
        icon="image"
        delay={0.3}
        actions={<CopyBtn text={result.imagePrompt} />}
      >
        <p className="text-xs font-mono text-slate-700 bg-slate-50 border border-slate-100 rounded p-3 leading-relaxed">
          {result.imagePrompt}
        </p>
        <p className="text-[10px] text-on-surface-variant mt-2">
          Used to render the thumbnail preview above via Gemini image generation.
        </p>
      </GlassCard>

      <GlassCard
        title="Alternative variations"
        icon="auto_awesome"
        delay={0.35}
        actions={
          <button
            type="button"
            disabled={variationsLoading}
            onClick={onRegenerateVariations}
            className="text-[11px] font-semibold px-2 py-1 rounded border border-surface-variant hover:bg-slate-50 disabled:opacity-50"
          >
            {variationsLoading ? "Refreshing…" : "Regenerate + render"}
          </button>
        }
      >
        {variationsLoading ? (
          <div className="grid gap-3 sm:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <ShimmerBlock key={i} className="aspect-video" />
            ))}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            {variationRows.map((v, i) => (
              <div
                key={i}
                className="rounded-md border border-surface-variant overflow-hidden bg-slate-50/80 hover:border-[#031634]/30 transition-colors"
              >
                {v.image?.dataUrl ? (
                  <img src={v.image.dataUrl} alt={v.label} className="w-full aspect-video object-cover" />
                ) : (
                  <div className="aspect-video flex items-center justify-center text-[10px] text-slate-400 px-2 text-center">
                    {v.imageError ? "Image failed" : "Regenerate to render previews"}
                  </div>
                )}
                <div className="p-3">
                  <p className="text-[10px] font-semibold uppercase text-slate-500 mb-1">{v.label}</p>
                  <p className="text-sm font-bold text-primary mb-1">{v.hook}</p>
                  <p className="text-[11px] text-slate-600">
                    {v.emotion} · {v.composition}
                  </p>
                  {v.image?.dataUrl && (
                    <button
                      type="button"
                      onClick={() => downloadDataUrl(v.image.dataUrl, `thumbnail-variation-${i + 1}.png`)}
                      className="mt-2 text-[10px] font-semibold underline text-[#031634]"
                    >
                      Download
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassCard>

      <GlassCard title="Title suggestions" icon="movie" delay={0.4}>
        {["viral", "curiosity", "authority", "highClick"].map((key) => (
          <div key={key} className="mb-3 last:mb-0">
            <p className="text-[10px] font-semibold uppercase text-slate-500 mb-1">{key}</p>
            <ul className="space-y-1">
              {(result.titleSuggestions?.[key] || []).map((t, i) => (
                <li key={i} className="text-sm text-slate-700 flex gap-2">
                  <span className="text-slate-400">•</span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </GlassCard>

      <GlassCard title="Attention hooks" icon="campaign" delay={0.45}>
        <ul className="space-y-2">
          {(result.attentionHooks || []).map((h, i) => (
            <li key={i} className="text-sm text-slate-700 pl-3 border-l-2 border-[#031634]/30">
              {h}
            </li>
          ))}
        </ul>
      </GlassCard>
    </div>
  );
}
