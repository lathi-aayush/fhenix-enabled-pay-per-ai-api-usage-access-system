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
export function buildStructuredRunResult({ workflowName, nodeResults, nodeMap, outputFormat }) {
  const steps = (nodeResults || [])
    .filter((r) => r.status === "completed" || r.status === "success")
    .map((r) => {
      const node = nodeMap?.[r.nodeId];
      const parsed = tryParseJson(r.output);
      const blogParsed = parsed?.blogPostId ? parsed : null;
      return {
        nodeId: r.nodeId,
        label: node?.data?.label || r.nodeId,
        type: node?.type || "unknown",
        status: r.status,
        tokensUsed: r.tokensUsed ?? 0,
        creditsDeducted: r.creditsDeducted ?? 0,
        ...(blogParsed
          ? { structured: { blog: blogParsed, title: blogParsed.title, summary: `Blog created (${blogParsed.status})` }, text: null }
          : parsed
            ? { structured: parsed, text: null }
            : { text: r.output || "" }),
      };
    });

  const blogNode = (nodeResults || []).find((r) => nodeMap?.[r.nodeId]?.type === "blog");
  const outputNode = (nodeResults || []).find((r) => nodeMap?.[r.nodeId]?.type === "output");
  const aiNodes = steps.filter((s) => s.type === "ai");
  const finalStep = blogNode
    ? steps.find((s) => s.nodeId === blogNode.nodeId)
    : outputNode
      ? steps.find((s) => s.nodeId === outputNode.nodeId)
      : aiNodes[aiNodes.length - 1] || steps[steps.length - 1];

  let finalContent = null;
  if (finalStep?.structured) {
    finalContent = finalStep.structured;
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
