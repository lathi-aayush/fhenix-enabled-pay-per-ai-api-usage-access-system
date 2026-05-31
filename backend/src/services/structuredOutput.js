export const FORMAT_PROMPTS = {
  summary: `Format your response exactly as markdown with these sections (use all that apply):
## Summary
(2-4 sentences)

## Key points
- bullet 1
- bullet 2

## Takeaways
- takeaway 1`,
  json: `Respond with valid JSON only (no markdown code fences). Use this schema:
{"title":"string","summary":"string","keyPoints":["string"],"takeaways":["string"],"details":"optional string"}`,
  report: `Format as markdown:
# Title
## Overview
(short paragraph)
## Analysis
(detailed paragraphs)
## Conclusion
## Action items
- item 1`,
};

export function getStructuredSystemSuffix(format) {
  const key = format && FORMAT_PROMPTS[format] ? format : "summary";
  return `\n\n---\nOutput format requirement:\n${FORMAT_PROMPTS[key]}`;
}

/** URLs the frontend can play via API base + /outputs/* or signed GCS links. */
export function isPlayableAssetUrl(url) {
  const u = String(url || "").trim();
  return (
    u.startsWith("http://") ||
    u.startsWith("https://") ||
    u.startsWith("/outputs/")
  );
}

export function pickAudioRef(audio) {
  if (!audio || typeof audio !== "object") return null;
  if (isPlayableAssetUrl(audio.url)) {
    return { mimeType: audio.mimeType || "audio/wav", url: audio.url };
  }
  if (typeof audio.dataUrl === "string" && audio.dataUrl.startsWith("data:")) {
    return { mimeType: audio.mimeType || "audio/wav", dataUrl: audio.dataUrl };
  }
  return null;
}

function stripHeavyMedia(obj) {
  if (!obj || typeof obj !== "object") return obj;
  const next = { ...obj };
  const audioRef = pickAudioRef(next.audio);
  if (audioRef) {
    next.audio = audioRef;
  } else if (next.audio?.dataUrl) {
    next.audio = {
      mimeType: next.audio.mimeType || "audio/wav",
      url: next.audio.url || null,
      hasAudio: true,
    };
  }
  if (Array.isArray(next.images)) {
    next.images = next.images
      .filter((img) => isPlayableAssetUrl(img?.url) || img?.dataUrl?.startsWith("data:"))
      .map((img) => (img?.url ? { url: img.url } : img?.dataUrl ? { dataUrl: img.dataUrl } : { placeholder: true }));
  }
  if (typeof next.content === "string" && next.content.length > 12_000) {
    next.content = `${next.content.slice(0, 12_000)}…`;
  }
  delete next.meta;
  return next;
}

/** Shrink structured run payload before MongoDB save (no inline base64). */
export function compactStructuredResult(payload) {
  if (!payload || typeof payload !== "object") return payload;

  const final = payload.final ? { ...payload.final } : null;
  if (final?.agentic) final.agentic = stripHeavyMedia(final.agentic);
  if (final?.audio?.dataUrl) {
    final.audio = { mimeType: final.audio.mimeType, url: final.audio.url || null };
  }
  if (final?.image?.dataUrl && !final.image?.url) {
    final.image = { mimeType: final.image.mimeType, url: final.image.url || null };
  }
  if (typeof final?.text === "string" && final.text.length > 16_000) {
    final.text = `${final.text.slice(0, 16_000)}…`;
  }

  const steps = (payload.steps || []).map((step) => {
    const s = { ...step };
    if (s.structured?.agentic) {
      s.structured = {
        ...s.structured,
        agentic: stripHeavyMedia(s.structured.agentic),
      };
    }
    if (s.structured?.audio?.dataUrl) {
      s.structured.audio = { mimeType: s.structured.audio.mimeType, url: s.structured.audio.url };
    }
    if (typeof s.text === "string" && s.text.length > 8000) {
      s.text = `${s.text.slice(0, 8000)}…`;
    }
    return s;
  });

  return {
    workflowName: payload.workflowName,
    format: payload.format,
    generatedAt: payload.generatedAt,
    final,
    steps,
    stats: payload.stats,
  };
}

export function tryParseJson(text) {
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

/**
 * Build final structured payload for output nodes and run summary.
 */
export function buildStructuredRunResult({
  workflowName,
  nodeResults,
  nodeMap,
  outputFormat,
  payloadByNodeId = {},
}) {
  const steps = (nodeResults || [])
    .filter((r) => r.status === "completed" || r.status === "success")
    .map((r) => {
      const node = nodeMap?.[r.nodeId];
      const parsed = tryParseJson(r.output);
      const blogParsed = parsed?.blogPostId ? parsed : null;
      const creativeParsed =
        parsed?.kind === "imageGen" || parsed?.kind === "promptGen" ? parsed : null;
      let agenticParsed =
        typeof parsed?.kind === "string" && parsed.kind.startsWith("agentic") ? parsed : null;
      const livePayload = payloadByNodeId[r.nodeId];
      if (agenticParsed && livePayload) {
        agenticParsed = { ...agenticParsed, ...livePayload };
        if (livePayload.audio?.url) agenticParsed.audio = livePayload.audio;
        if (livePayload.images?.length) agenticParsed.images = livePayload.images;
        if (livePayload.videoUri) agenticParsed.videoUri = livePayload.videoUri;
      }
      return {
        nodeId: r.nodeId,
        label: node?.data?.label || r.nodeId,
        type: node?.type || "unknown",
        status: r.status,
        tokensUsed: r.tokensUsed ?? 0,
        creditsDeducted: r.creditsDeducted ?? 0,
        ...(blogParsed
          ? { structured: { blog: blogParsed, title: blogParsed.title, summary: `Blog created (${blogParsed.status})` }, text: null }
          : agenticParsed
            ? {
                structured: {
                  title: agenticParsed.kind.replace("agentic", "Agentic "),
                  summary: agenticParsed.displayPreview || agenticParsed.agent,
                  agentic: stripHeavyMedia(agenticParsed),
                  images: (agenticParsed.images || []).filter(
                    (img) => isPlayableAssetUrl(img?.url) || img?.dataUrl?.startsWith("data:")
                  ),
                  audio: pickAudioRef(agenticParsed.audio),
                  videoUri: isPlayableAssetUrl(agenticParsed.videoUri)
                    ? agenticParsed.videoUri
                    : agenticParsed.videoUri,
                  text:
                    agenticParsed.agent === "text" && typeof agenticParsed.content === "string"
                      ? agenticParsed.content
                      : undefined,
                },
                text: null,
              }
          : creativeParsed?.kind === "imageGen"
            ? {
                structured: {
                  title: "Generated image",
                  summary: creativeParsed.imageWarning || "Image ready",
                  image: creativeParsed.image,
                  imagePrompt: creativeParsed.imagePrompt,
                  prompt: creativeParsed.prompt,
                },
                text: null,
              }
          : creativeParsed?.kind === "promptGen"
            ? {
                structured: {
                  title: "Generated prompt",
                  summary: String(creativeParsed.prompt || "").slice(0, 400),
                  prompt: creativeParsed.prompt,
                },
                text: null,
              }
          : parsed
            ? { structured: parsed, text: null }
            : { text: r.output || "" }),
      };
    });

  const blogNode = (nodeResults || []).find((r) => nodeMap?.[r.nodeId]?.type === "blog");
  const outputNode = (nodeResults || []).find((r) => nodeMap?.[r.nodeId]?.type === "output");
  const aiNodes = steps.filter((s) => s.type === "ai");
  const imageNode = (nodeResults || []).find((r) => nodeMap?.[r.nodeId]?.type === "imageGen");
  const agenticPriority = ["agenticVideo", "agenticAudio", "agenticImage", "agenticText"];
  let agenticNode = null;
  for (const t of agenticPriority) {
    const found = (nodeResults || []).find((r) => nodeMap?.[r.nodeId]?.type === t);
    if (found) {
      agenticNode = found;
      break;
    }
  }
  const finalStep = agenticNode
    ? steps.find((s) => s.nodeId === agenticNode.nodeId)
    : imageNode
    ? steps.find((s) => s.nodeId === imageNode.nodeId)
    : blogNode
    ? steps.find((s) => s.nodeId === blogNode.nodeId)
    : outputNode
      ? steps.find((s) => s.nodeId === outputNode.nodeId)
      : aiNodes[aiNodes.length - 1] || steps[steps.length - 1];

  let finalContent = null;
  if (finalStep?.structured) {
    finalContent = { ...finalStep.structured };
  } else if (finalStep?.text) {
    const parsed = tryParseJson(finalStep.text);
    if (parsed?.blogPostId) {
      finalContent = {
        title: parsed.title,
        summary: `Blog post created (${parsed.status}). ${parsed.wordCount || 0} words.`,
        keyPoints: [
          `Post ID: ${parsed.blogPostId}`,
          parsed.scheduled && parsed.scheduledFor
            ? `Scheduled: ${new Date(parsed.scheduledFor).toLocaleString()}`
            : parsed.queuedPlatforms?.length
              ? `Publishing to: ${parsed.queuedPlatforms.join(", ")}`
              : "Open in Blogging Agent to edit or publish",
        ],
        takeaways: [`Edit path: ${parsed.editPath || "/studio/blogging-agent"}`],
        blog: parsed,
      };
    } else {
      finalContent = parsed || { summary: finalStep.text };
    }
  }

  if (finalContent) {
    const audioStep = [...steps].reverse().find((s) => pickAudioRef(s.structured?.audio));
    const audioRef = pickAudioRef(audioStep?.structured?.audio);
    if (audioRef && !pickAudioRef(finalContent.audio)) {
      finalContent.audio = audioRef;
    }
    if (!finalContent.summary && audioRef) {
      finalContent.summary = "Voiceover audio ready — play or download below.";
    }
  }

  return {
    workflowName: workflowName || "Workflow",
    format: outputFormat || "summary",
    generatedAt: new Date().toISOString(),
    final: finalContent,
    steps,
    stats: {
      totalTokens: (nodeResults || []).reduce((s, r) => s + (r.tokensUsed || 0), 0),
      totalCredits: (nodeResults || []).reduce((s, r) => s + (r.creditsDeducted || 0), 0),
      stepCount: steps.length,
    },
  };
}

export function formatStructuredForDisplay(payload) {
  return JSON.stringify(payload, null, 2);
}
