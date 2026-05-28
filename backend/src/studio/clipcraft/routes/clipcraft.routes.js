// @filename: backend/src/studio/clipcraft/routes/clipcraft.routes.js

import { Router } from "express";
import { requireAuth } from "../../../middleware/auth.js";
import { getClipCraftRuntime } from "../production/ClipCraftRuntime.js";
import { getClipCraftHealth } from "../production/health.js";
import { exportChecklistJson, PRODUCTION_VALIDATION_CHECKLIST } from "../production/validationChecklist.js";
import { loadClipCraftConfig } from "../config/loadConfig.js";

const router = Router();

router.get("/health", (_req, res) => {
  const cfg = loadClipCraftConfig();
  if (!cfg.enabled) return res.json({ ok: true, service: "clipcraft", status: "disabled" });
  const runtime = getClipCraftRuntime();
  runtime.start();
  const health = getClipCraftHealth(runtime);
  res.status(health.ok ? 200 : 503).json(health);
});

router.get("/checklist", (_req, res) => {
  res.type("application/json").send(exportChecklistJson());
});

router.get("/checklist/items", (_req, res) => {
  res.json({ checklist: PRODUCTION_VALIDATION_CHECKLIST });
});

router.use(requireAuth);

router.post("/jobs", async (req, res) => {
  const runtime = getClipCraftRuntime();
  runtime.start();
  const { url, tier, packCount, exportTargets } = req.body;
  const idempotencyKey =
    req.headers["idempotency-key"] || req.body.idempotencyKey || req.body.idempotency_key;
  if (!url?.trim()) return res.status(400).json({ error: "url required" });
  if (!idempotencyKey) {
    return res.status(400).json({ error: "Idempotency-Key header or idempotencyKey required" });
  }

  try {
    const result = await runtime.submitJob({
      userId: req.user.userId,
      url: url.trim(),
      tier: tier === "viral" ? "viral" : "standard",
      packCount: packCount ?? 1,
      idempotencyKey: String(idempotencyKey),
      exportTargets,
    });
    res.status(result.idempotentReplay ? 200 : 202).json({
      ok: true,
      idempotentReplay: !!result.idempotentReplay,
      job: result.job,
      creditsDeducted: result.creditsDeducted,
      transactionId: result.transactionId,
    });
  } catch (e) {
    if (e.code === "RATE_LIMITED") {
      return res.status(429).json({
        error: e.message,
        retryAfterMs: e.retryAfterMs,
      });
    }
    if (e.code === "INSUFFICIENT_CREDITS") {
      return res.status(402).json({ error: e.message });
    }
    if (e.code === "CLIPCRAFT_DISABLED") {
      return res.status(503).json({ error: e.message });
    }
    return res.status(400).json({ error: e.message });
  }
});

router.get("/jobs", async (req, res) => {
  const runtime = getClipCraftRuntime();
  const jobs = runtime.listJobs(req.user.userId);
  res.json({ jobs });
});

router.get("/jobs/:id", async (req, res) => {
  const runtime = getClipCraftRuntime();
  const job = runtime.getJob(req.params.id);
  if (!job || job.userId !== req.user.userId) {
    return res.status(404).json({ error: "Job not found" });
  }
  res.json({ job });
});

export default router;
