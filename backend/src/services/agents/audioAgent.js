import fs from "fs";
import path from "path";
import os from "os";
import { getGeminiApiKey } from "../../utils/geminiRest.js";
import { extractNarrationFromScript } from "../../utils/scriptSceneParser.js";
import { ttsInlineToPlayableBuffer } from "../../utils/pcmToWav.js";

function resolveNarration(inputText, priorOutput) {
  let narration = String(inputText || "").trim();
  if (priorOutput?.agent === "text" && priorOutput.content) {
    const fromScript = extractNarrationFromScript(priorOutput.content);
    if (fromScript) {
      narration = fromScript;
    } else {
      narration = String(priorOutput.content)
        .replace(/#{1,3}\s*SCENE\s*\d+[^\n]*/gi, " ")
        .replace(/\*\*/g, "")
        .replace(/\s+/g, " ")
        .trim();
    }
  }
  narration = narration.slice(0, 4000);
  if (!narration) throw new Error("No narration text for TTS (connect Text Agent or add script)");
  return narration;
}

export async function runAudioAgent(inputText, memory, priorOutput = null) {
  const narration = resolveNarration(inputText, priorOutput);

  const apiKey = getGeminiApiKey();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(120_000),
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: narration }] }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } },
        },
      },
    }),
  });

  const raw = await res.text();
  let data = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    throw new Error("TTS returned invalid JSON");
  }
  if (!res.ok) {
    throw new Error(data?.error?.message || "TTS generation failed");
  }

  const inline = data?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData;
  if (!inline?.data) {
    throw new Error("TTS returned no audio data");
  }

  const { buffer, ext, mimeType } = ttsInlineToPlayableBuffer(inline);
  const filePath = path.join(os.tmpdir(), `tts_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`);
  await fs.promises.writeFile(filePath, buffer);

  return {
    agent: "audio",
    content: filePath,
    meta: {
      model: "gemini-2.5-flash-preview-tts",
      voice: "Kore",
      mimeType,
      bytes: buffer.length,
      narrationChars: narration.length,
    },
  };
}
