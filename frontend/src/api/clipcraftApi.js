import { api } from "./client.js";

export async function getClipCraftHealth() {
  const { data } = await api.get("/api/studio/clipcraft/health");
  return data;
}

export async function listClipJobs() {
  const { data } = await api.get("/api/studio/clipcraft/jobs");
  return data.jobs ?? [];
}

export async function getClipJob(jobId) {
  const { data } = await api.get(`/api/studio/clipcraft/jobs/${jobId}`);
  return data.job;
}

export async function submitClipJob({ url, tier, packCount, idempotencyKey }) {
  const { data } = await api.post(
    "/api/studio/clipcraft/jobs",
    { url, tier, packCount },
    { headers: { "Idempotency-Key": idempotencyKey } }
  );
  return data;
}

const TERMINAL = new Set(["ready", "failed"]);

export function isClipJobDone(status) {
  return TERMINAL.has(status);
}

/** Poll until ready or failed */
export async function pollClipJob(jobId, { intervalMs = 800, timeoutMs = 120000, onUpdate } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const job = await getClipJob(jobId);
    onUpdate?.(job);
    if (isClipJobDone(job.status)) return job;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error("Clip generation timed out — check Render Queue or try again.");
}
