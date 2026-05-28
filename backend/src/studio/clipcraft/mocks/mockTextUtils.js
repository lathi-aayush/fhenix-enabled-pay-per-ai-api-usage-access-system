/** @param {number} sec */
export function formatTs(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** @param {string} text @param {number} max */
export function firstSentence(text, max = 120) {
  const t = (text || "").trim();
  if (!t) return "";
  const cut = t.match(/^[^.!?]+[.!?]?/)?.[0]?.trim() || t;
  return cut.length > max ? `${cut.slice(0, max - 1)}…` : cut;
}

/** @param {string} text @param {number} n */
export function words(text, n = 8) {
  return (text || "")
    .replace(/[^\w\s'-]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, n)
    .join(" ");
}

/** @param {string} text @param {number} idx */
export function hashtagsFromText(text, idx) {
  const base = ["#shorts", "#creator", "#clipcraft"];
  const tokens = (text || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 4 && !["about", "there", "which", "their", "would"].includes(w));
  const unique = [...new Set(tokens)].slice(0, 4).map((w) => `#${w.slice(0, 24)}`);
  const extra = ["#growth", "#tips", "#viral", "#learn", "#howto", "#story"][idx % 6];
  return [...new Set([...unique, ...base, extra])].slice(0, 8);
}

export const SENTIMENT_POOL = [
  "curiosity",
  "excitement",
  "urgency",
  "insight",
  "surprise",
  "confidence",
  "empathy",
  "humor",
];
