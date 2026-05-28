// @filename: backend/src/studio/clipcraft/mocks/MockSegmentAnalyzer.js

import { asSegmentAnalyzer } from "../interfaces/ISegmentAnalyzer.js";
import { SENTIMENT_POOL } from "./mockTextUtils.js";

const MAX_PACK = 20;

/**
 * Pick transcript lines overlapping [start, end].
 * @param {import('../interfaces/ITranscriptProvider.js').TranscriptCue[]} cues
 */
function cuesInRange(cues, start, end) {
  return cues.filter((c) => c.end > start && c.start < end);
}

export function createMockSegmentAnalyzer() {
  return asSegmentAnalyzer({
    async analyzeSegments({ transcript, maxSegments = 3, targetDurationSec = [30, 60] }) {
      const packCount = Math.min(MAX_PACK, Math.max(1, Math.floor(Number(maxSegments) || 1)));
      const [minDur, maxDur] = targetDurationSec;
      const cues = transcript?.cues ?? [];
      if (!cues.length) {
        return { segments: [], analyzerMeta: { mock: true, packCount, reason: "no_cues" } };
      }

      const timelineEnd = cues[cues.length - 1].end;
      const candidates = [];

      for (let n = 0; n < packCount; n++) {
        const slot = packCount <= 1 ? 0 : n / (packCount - 1);
        const idealStart = slot * Math.max(0, timelineEnd - minDur);
        const overlap = cuesInRange(cues, idealStart, idealStart + maxDur);
        const anchor = overlap[0] ?? cues[Math.min(n, cues.length - 1)];
        const start = Math.max(0, anchor.start);
        let end = Math.min(timelineEnd, start + minDur + 8 + (n % 4) * 6);
        if (end - start < minDur) end = Math.min(timelineEnd, start + minDur);
        if (end - start > maxDur) end = start + maxDur;
        if (end <= start) continue;

        const windowCues = cuesInRange(cues, start, end);
        const sourceText = windowCues.map((c) => c.text).join(" ").trim();

        candidates.push({
          id: `seg-${n + 1}`,
          startTs: start,
          endTs: end,
          duration: end - start,
          engagementScore: Math.min(0.98, 0.68 + (n % 7) * 0.04 + (windowCues.length > 2 ? 0.05 : 0)),
          sentimentLabel: SENTIMENT_POOL[n % SENTIMENT_POOL.length],
          confidence: 0.82 - (n % 5) * 0.03,
          rationale: sourceText.slice(0, 160) || "Highlight window",
          sourceText,
        });
      }

      return {
        segments: candidates,
        analyzerMeta: { mock: true, model: "mock-segment-v2", requestedPacks: packCount },
      };
    },
  });
}
