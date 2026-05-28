import { YoutubeTranscript } from "youtube-transcript";

const YT_ID =
  /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i;

export function extractYoutubeVideoId(input) {
  const s = String(input || "").trim();
  const m = s.match(YT_ID);
  return m?.[1] || null;
}

export function isYoutubeUrl(input) {
  return Boolean(extractYoutubeVideoId(input));
}

async function fetchOEmbed(url) {
  const res = await fetch(
    `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`,
    { headers: { "User-Agent": "SentinelWorkflow/1.0" } }
  );
  if (!res.ok) throw new Error(`oEmbed failed (${res.status})`);
  return res.json();
}

async function fetchTranscript(videoId) {
  const segments = await YoutubeTranscript.fetchTranscript(videoId, { lang: "en" });
  if (!segments?.length) return "";
  return segments.map((s) => s.text).join(" ").replace(/\s+/g, " ").trim();
}

/**
 * Turn a YouTube URL into text the LLM can reason over (title + transcript).
 */
export async function enrichYoutubeUrl(url) {
  const videoId = extractYoutubeVideoId(url);
  if (!videoId) throw new Error("Invalid YouTube URL");

  const canonical = `https://www.youtube.com/watch?v=${videoId}`;
  const meta = await fetchOEmbed(canonical);

  let transcript = "";
  try {
    transcript = await fetchTranscript(videoId);
  } catch {
    transcript = "";
  }

  const parts = [
    "=== YouTube video (fetched for workflow) ===",
    `Title: ${meta.title || "Unknown"}`,
    `Channel: ${meta.author_name || "Unknown"}`,
    `URL: ${canonical}`,
  ];

  if (transcript) {
    const capped = transcript.length > 12000 ? `${transcript.slice(0, 12000)}…` : transcript;
    parts.push("", "Transcript:", capped);
  } else {
    parts.push(
      "",
      "Transcript: (not available — video may have no captions or captions are disabled.)",
      "Use the title/channel and any user instructions to respond."
    );
  }

  return parts.join("\n");
}

export async function enrichInputValue(value, inputType) {
  const raw = String(value || "").trim();
  if (!raw) return raw;

  const shouldEnrich =
    inputType === "youtube" || inputType === "url" || isYoutubeUrl(raw);

  if (!shouldEnrich || !isYoutubeUrl(raw)) return raw;

  return enrichYoutubeUrl(raw);
}
