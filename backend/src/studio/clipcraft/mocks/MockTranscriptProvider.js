// @filename: backend/src/studio/clipcraft/mocks/MockTranscriptProvider.js

import { asTranscriptProvider } from "../interfaces/ITranscriptProvider.js";

/** Rich demo transcript — enough cues for many clip packs */
const SAMPLE_CUES = [
  { start: 0, end: 12, text: "Welcome back — today we break down the one metric that changes everything for creators." },
  { start: 12, end: 28, text: "Most people lose viewers in the first thirty seconds because the hook promises the wrong payoff." },
  { start: 28, end: 48, text: "Pattern interrupt: show the outcome first, then rewind to how you got there." },
  { start: 48, end: 72, text: "Case study one — a fitness channel doubled retention by moving the CTA to second twelve." },
  { start: 72, end: 98, text: "Case study two — B2B SaaS used a contrarian stat in the thumbnail and lifted CTR forty percent." },
  { start: 98, end: 125, text: "Here is the three-step framework: hook, proof, payoff. Never skip proof on educational content." },
  { start: 125, end: 152, text: "Step one: name the enemy — the habit or belief your audience needs to drop." },
  { start: 152, end: 178, text: "Step two: social proof in under eight seconds — screenshot, quote, or live demo." },
  { start: 178, end: 205, text: "Step three: deliver the actionable takeaway before the thirty-second mark when possible." },
  { start: 205, end: 232, text: "Editing trick: jump-cut on every verb to keep energy without adding B-roll cost." },
  { start: 232, end: 258, text: "Caption strategy: first line is a question, second line is the answer tease." },
  { start: 258, end: 285, text: "Hashtag mix: two broad, two niche, one branded — rotate per clip so you do not look spammy." },
  { start: 285, end: 312, text: "If you are selling a template, show the before state in frame one and after in frame three." },
  { start: 312, end: 340, text: "Community prompt: ask viewers to comment their niche and reply with a custom hook variant." },
  { start: 340, end: 380, text: "Final thought: ship the clip before it feels perfect — momentum beats polish for Shorts." },
];

export function createMockTranscriptProvider() {
  return asTranscriptProvider({
    async fetchTranscript({ videoId, platform }) {
      const cues = SAMPLE_CUES.map((c) => ({ ...c }));
      return {
        videoId: videoId || "mock",
        language: "en",
        cues,
        fullText: cues.map((c) => c.text).join(" "),
        providerMeta: { mock: true, platform, cueCount: cues.length },
      };
    },
  });
}
