// @filename: backend/src/studio/clipcraft/mocks/MockCopyGenerator.js

import { asCopyGenerator } from "../interfaces/ICopyGenerator.js";
import { firstSentence, formatTs, words, hashtagsFromText } from "./mockTextUtils.js";

export function createMockCopyGenerator() {
  return asCopyGenerator({
    async generateCopy({ segments, tier }) {
      const viral = tier === "viral";
      const out = segments.map((seg, idx) => {
        const excerpt = seg.sourceText || seg.rationale || "";
        const lead = firstSentence(excerpt, 90);
        const snippet = words(excerpt, 10);
        const pct = Math.round((seg.engagementScore ?? 0.7) * 100);
        const ts = formatTs(seg.startTs);

        const hooks = viral
          ? [
              lead ? `${lead}` : `Clip ${idx + 1}: ${seg.sentimentLabel} moment at ${ts}`,
              snippet ? `POV: "${snippet}" — (${seg.duration}s)` : `Nobody talks about this at ${ts}`,
              `Save this before ${["Monday", "the algorithm shifts", "your next upload"][idx % 3]}`,
            ]
          : [
              lead || `Why ${seg.sentimentLabel} spikes at ${ts}`,
              snippet ? `In ${seg.duration}s: ${snippet}` : `Quick takeaway (${pct}% engagement window)`,
              `Timestamp ${ts} — ${seg.sentimentLabel} beat #${idx + 1}`,
            ];

        const caption = viral
          ? `${lead} (${seg.duration}s · ${ts}). Comment if you want part ${idx + 2}.`
          : `${lead} [${ts}–${formatTs(seg.endTs)}]`;

        return {
          segmentId: seg.id,
          hooks,
          caption,
          hashtags: hashtagsFromText(excerpt, idx),
          isViralOptimized: viral,
        };
      });
      return { segments: out, generatorMeta: { mock: true, tier, version: "mock-copy-v2" } };
    },
  });
}
