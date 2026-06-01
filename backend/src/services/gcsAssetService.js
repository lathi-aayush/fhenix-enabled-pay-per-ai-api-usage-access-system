import fs from "fs";
import path from "path";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import { fileURLToPath } from "url";
import { Storage } from "@google-cloud/storage";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKFLOW_OUTPUT_DIR = path.join(__dirname, "..", "..", "outputs", "workflow");

const SIGNED_TTL_SEC = Number(process.env.GCS_SIGNED_URL_TTL_SEC || 3600);
const PREFIX = (process.env.GCS_ASSET_PREFIX || "sentinal").replace(/^\/|\/$/g, "");

let storage;

function getBucketName() {
  return (process.env.GCS_ASSETS_BUCKET || "").trim();
}

export function isGcsConfigured() {
  const project = (process.env.GOOGLE_CLOUD_PROJECT || "").trim();
  const bucket = getBucketName();
  return Boolean(project && bucket);
}

function getStorage() {
  if (!storage) {
    storage = new Storage({
      projectId: process.env.GOOGLE_CLOUD_PROJECT?.trim(),
    });
  }
  return storage;
}

function getBucket() {
  const name = getBucketName();
  if (!name) throw new Error("GCS_ASSETS_BUCKET is not set");
  return getStorage().bucket(name);
}

function objectPath(...parts) {
  return [PREFIX, ...parts.filter(Boolean)].join("/");
}

export async function getSignedUrl(objectPath, ttlSec = SIGNED_TTL_SEC) {
  const [url] = await getBucket().file(objectPath).getSignedUrl({
    version: "v4",
    action: "read",
    expires: Date.now() + ttlSec * 1000,
  });
  return url;
}

export async function uploadBuffer(buffer, destPath, contentType) {
  const file = getBucket().file(destPath);
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  const writeStream = file.createWriteStream({
    resumable: false,
    validation: false,
    metadata: {
      contentType,
      cacheControl: "public, max-age=3600",
    },
  });
  await pipeline(Readable.from(buf), writeStream);
  return getSignedUrl(destPath);
}

export async function uploadBase64Image(b64, destPath) {
  const buf = Buffer.from(b64, "base64");
  return uploadBuffer(buf, destPath, "image/jpeg");
}

export async function uploadLocalFile(localPath, destPath, contentType) {
  const buf = fs.readFileSync(localPath);
  return uploadBuffer(buf, destPath, contentType);
}

/** Turn gs://bucket/object into a signed HTTPS URL. */
export async function resolveGcsUri(uri) {
  const raw = String(uri || "").trim();
  if (!raw) return null;
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  if (!raw.startsWith("gs://")) return raw;

  const without = raw.slice("gs://".length);
  const slash = without.indexOf("/");
  if (slash < 0) return null;
  const bucket = without.slice(0, slash);
  const object = without.slice(slash + 1);
  const configured = getBucketName();
  if (configured && bucket !== configured) {
    console.warn(`[gcs] URI bucket ${bucket} differs from GCS_ASSETS_BUCKET ${configured}`);
  }
  const [url] = await getStorage().bucket(bucket).file(object).getSignedUrl({
    version: "v4",
    action: "read",
    expires: Date.now() + SIGNED_TTL_SEC * 1000,
  });
  return url;
}

/**
 * Upload heavy agentic assets to GCS; replace data URLs / temp paths with signed URLs.
 */
export async function publishAgenticPayloadToGcs(payload, { scope = "pipeline", runId, nodeId }) {
  if (!isGcsConfigured() || !payload) return payload;

  const base = objectPath(scope, String(runId), nodeId || "output");

  if (payload.agent === "image" || payload.kind === "agenticImage") {
    const urls = [];
    const b64List = Array.isArray(payload.content)
      ? payload.content.filter((x) => typeof x === "string" && !x.startsWith("http"))
      : [];

    if (b64List.length) {
      for (let i = 0; i < b64List.length; i++) {
        const url = await uploadBase64Image(b64List[i], `${base}/images/${i}.jpg`);
        urls.push(url);
      }
    } else if (payload.meta?.dataUrls?.length) {
      for (let i = 0; i < payload.meta.dataUrls.length; i++) {
        const d = payload.meta.dataUrls[i];
        if (typeof d === "string" && d.startsWith("data:image")) {
          const b64 = d.split(",")[1];
          if (b64) urls.push(await uploadBase64Image(b64, `${base}/images/${i}.jpg`));
        } else if (typeof d === "string" && d.startsWith("http")) {
          urls.push(d);
        }
      }
    } else if (Array.isArray(payload.images)) {
      for (let i = 0; i < payload.images.length; i++) {
        const img = payload.images[i];
        if (img?.url?.startsWith("http")) urls.push(img.url);
        else if (img?.dataUrl?.startsWith("data:image")) {
          const b64 = img.dataUrl.split(",")[1];
          if (b64) urls.push(await uploadBase64Image(b64, `${base}/images/${i}.jpg`));
        }
      }
    }

    payload.content = urls;
    payload.images = urls.map((url) => ({ url }));
    delete payload.meta?.dataUrls;
  }

  if (payload.agent === "audio" || payload.kind === "agenticAudio") {
    const tmp =
      payload.audio?.tempPath ||
      (typeof payload.content === "string" && !payload.content.startsWith("http")
        ? payload.content
        : null);
    if (typeof tmp === "string" && tmp && fs.existsSync(tmp)) {
      const ext = path.extname(tmp).slice(1) || "wav";
      const mime = ext === "mp3" ? "audio/mpeg" : "audio/wav";
      const url = await uploadLocalFile(tmp, `${base}/audio.${ext}`, mime);
      payload.content = url;
      payload.audio = { mimeType: mime, url };
      try {
        fs.unlinkSync(tmp);
      } catch {
        /* ignore */
      }
    } else if (payload.audio?.dataUrl?.startsWith("data:")) {
      const b64 = payload.audio.dataUrl.split(",")[1];
      if (b64) {
        const url = await uploadBuffer(Buffer.from(b64, "base64"), `${base}/audio.wav`, "audio/wav");
        payload.content = url;
        payload.audio = { mimeType: "audio/wav", url };
      }
    }
  }

  if (payload.agent === "video" || payload.kind === "agenticVideo") {
    const signed = await resolveGcsUri(payload.videoUri || payload.content);
    if (signed) {
      payload.content = signed;
      payload.videoUri = signed;
    }
  }

  return payload;
}

/** GCS when configured; otherwise copy assets under /outputs/workflow for playback. */
export async function publishAgenticAssets(payload, opts) {
  if (isGcsConfigured()) {
    try {
      return await publishAgenticPayloadToGcs(payload, opts);
    } catch (err) {
      console.error("[gcs] publish failed, falling back to local files:", err.message);
      return publishAgenticPayloadLocal(payload, opts);
    }
  }
  return publishAgenticPayloadLocal(payload, opts);
}

export async function publishAgenticPayloadLocal(payload, { scope = "workflow", runId, nodeId }) {
  if (!payload) return payload;

  const relBase = `${scope}/${runId}/${nodeId || "output"}`;
  const absBase = path.join(WORKFLOW_OUTPUT_DIR, scope, String(runId), nodeId || "output");
  fs.mkdirSync(absBase, { recursive: true });

  if (payload.agent === "image" || payload.kind === "agenticImage") {
    const urls = [];
    const b64List = Array.isArray(payload.content)
      ? payload.content.filter((x) => typeof x === "string" && !x.startsWith("http"))
      : [];
    for (let i = 0; i < b64List.length; i++) {
      const dest = path.join(absBase, `image_${i}.jpg`);
      fs.writeFileSync(dest, Buffer.from(b64List[i], "base64"));
      urls.push(`/outputs/workflow/${relBase}/image_${i}.jpg`);
    }
    if (urls.length) {
      payload.content = urls;
      payload.images = urls.map((url) => ({ url }));
    }
  }

  if (payload.agent === "audio" || payload.kind === "agenticAudio") {
    const tmp =
      payload.audio?.tempPath ||
      (typeof payload.content === "string" && !payload.content.startsWith("http")
        ? payload.content
        : null);
    if (typeof tmp === "string" && fs.existsSync(tmp)) {
      const ext = path.extname(tmp).slice(1) || "wav";
      const mime = ext === "mp3" ? "audio/mpeg" : "audio/wav";
      const dest = path.join(absBase, `audio.${ext}`);
      fs.copyFileSync(tmp, dest);
      const url = `/outputs/workflow/${relBase}/audio.${ext}`;
      payload.content = url;
      payload.audio = { mimeType: mime, url };
      try {
        fs.unlinkSync(tmp);
      } catch {
        /* ignore */
      }
    }
  }

  return payload;
}

export async function publishCreativeImageLocal(creativePayload, { runId, label = "image" }) {
  if (!creativePayload?.image?.dataUrl) return creativePayload;

  const relBase = `creative/${runId}/${label}`;
  const absBase = path.join(WORKFLOW_OUTPUT_DIR, "creative", String(runId), label);
  fs.mkdirSync(absBase, { recursive: true });

  const b64 = creativePayload.image.dataUrl.split(",")[1];
  if (!b64) return creativePayload;

  const dest = path.join(absBase, "image.jpg");
  fs.writeFileSync(dest, Buffer.from(b64, "base64"));
  const url = `/outputs/workflow/${relBase}/image.jpg`;
  creativePayload.image = { mimeType: creativePayload.image.mimeType || "image/jpeg", url };
  creativePayload.imageUrl = url;
  return creativePayload;
}

export async function publishCreativeImage(creativePayload, opts) {
  if (isGcsConfigured()) {
    return publishCreativeImageToGcs(creativePayload, opts);
  }
  return publishCreativeImageLocal(creativePayload, opts);
}

export async function publishCreativeImageToGcs(creativePayload, { runId, label = "image" }) {
  if (!isGcsConfigured() || !creativePayload?.image?.dataUrl) return creativePayload;

  const base = objectPath("creative", String(runId || Date.now()), label);
  const b64 = creativePayload.image.dataUrl.split(",")[1];
  if (!b64) return creativePayload;

  const url = await uploadBase64Image(b64, `${base}.jpg`);
  creativePayload.image = { mimeType: creativePayload.image.mimeType || "image/jpeg", url };
  creativePayload.imageUrl = url;
  return creativePayload;
}
