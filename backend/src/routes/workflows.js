import { Router } from "express";
import rateLimit from "express-rate-limit";
import sanitizeHtml from "sanitize-html";
import { requireAuth } from "../middleware/auth.js";
import { attachWorkflowOwner, workflowPaymentGate } from "../middleware/workflowAuth.js";
import { Workflow } from "../models/Workflow.js";
import { WorkflowRun } from "../models/WorkflowRun.js";
import { AgentTemplate } from "../models/AgentTemplate.js";
import { validateDAG } from "../services/workflowExecutor.js";
import { executeWorkflow } from "../services/workflowExecutor.js";
import {
  estimateRunCost,
  createPaymentChallenge,
  verifyAndCharge,
  refundOverpayment,
} from "../services/x402PaymentService.js";
import { subscribeRun } from "../services/workflowRunStream.js";

const router = Router();

const runLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { success: false, error: "Workflow run limit exceeded (10 per hour)" },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.userId || req.ip,
});

let templateCache = { at: 0, data: null };
const TEMPLATE_CACHE_MS = 5 * 60 * 1000;

function stripHtml(s) {
  return sanitizeHtml(String(s || ""), { allowedTags: [], allowedAttributes: {} }).trim();
}

function sanitizeWorkflowPayload(body) {
  const name = stripHtml(body.name);
  const description = stripHtml(body.description);
  const nodes = (body.nodes || []).map((n) => ({
    ...n,
    data: {
      ...n.data,
      label: stripHtml(n.data?.label),
      systemPrompt: stripHtml(n.data?.systemPrompt),
      value: stripHtml(n.data?.value),
      conditionExpression: stripHtml(n.data?.conditionExpression),
      destination: stripHtml(n.data?.destination),
    },
  }));
  return { name, description, nodes, edges: body.edges || [] };
}

const DEFAULT_TEMPLATES = [
  {
    name: "Topic → Blog → Publish",
    category: "Writing",
    description: "Research a topic, generate a publish-ready post in Blogging Agent, optional auto-publish",
    tags: ["blog", "writing", "publish"],
    estimatedCreditsPerRun: 0.015,
    isFeatured: true,
    nodeStructure: {
      nodes: [
        {
          id: "node_input",
          type: "input",
          position: { x: 60, y: 200 },
          data: { label: "Topic", inputType: "text", value: "", config: {} },
        },
        {
          id: "node_ai",
          type: "ai",
          position: { x: 320, y: 200 },
          data: {
            label: "Research & outline",
            model: "llama-3.3-70b-versatile",
            systemPrompt:
              "Research this topic thoroughly. Output structured notes: key facts, audience angle, outline with H2 sections, and 5 SEO keywords.",
            outputFormat: "summary",
            temperature: 0.6,
            maxTokens: 1536,
            estimatedCredits: 0.006,
            config: {},
          },
        },
        {
          id: "node_blog",
          type: "blog",
          position: { x: 600, y: 200 },
          data: {
            label: "Blog Agent",
            tone: "professional",
            wordCount: 1200,
            publishMode: "studio",
            platforms: [],
            targetAudience: "",
            config: {},
          },
        },
      ],
      edges: [
        { id: "edge_1", source: "node_input", target: "node_ai", animated: true },
        { id: "edge_2", source: "node_ai", target: "node_blog", animated: true },
      ],
    },
  },
  {
    name: "YouTube → Blog Post",
    category: "Media",
    description: "Summarize a YouTube video and create a full blog article in Studio",
    tags: ["youtube", "blog", "media"],
    estimatedCreditsPerRun: 0.018,
    isFeatured: true,
    nodeStructure: {
      nodes: [
        {
          id: "yt_in",
          type: "input",
          position: { x: 60, y: 220 },
          data: { label: "YouTube URL", inputType: "youtube", value: "", config: {} },
        },
        {
          id: "yt_ai",
          type: "ai",
          position: { x: 320, y: 220 },
          data: {
            label: "Video insights",
            model: "llama-3.3-70b-versatile",
            systemPrompt:
              "From the video transcript, extract: main thesis, 8 key points, quotes worth citing, and a blog angle. Use structured sections.",
            outputFormat: "summary",
            maxTokens: 1536,
            estimatedCredits: 0.006,
            config: {},
          },
        },
        {
          id: "yt_blog",
          type: "blog",
          position: { x: 600, y: 220 },
          data: {
            label: "Write & publish blog",
            tone: "educational",
            wordCount: 1400,
            publishMode: "studio",
            platforms: [],
            config: {},
          },
        },
      ],
      edges: [
        { id: "e_yt1", source: "yt_in", target: "yt_ai", animated: true },
        { id: "e_yt2", source: "yt_ai", target: "yt_blog", animated: true },
      ],
    },
  },
  {
    name: "Code Review Agent",
    category: "Code",
    description: "Paste code and get a structured review",
    tags: ["code", "review"],
    estimatedCreditsPerRun: 0.006,
    nodeStructure: {
      nodes: [
        {
          id: "n1",
          type: "input",
          position: { x: 100, y: 180 },
          data: { label: "Code snippet", inputType: "text", value: "", config: {} },
        },
        {
          id: "n2",
          type: "ai",
          position: { x: 400, y: 180 },
          data: {
            label: "Reviewer",
            model: "llama-3.1-8b-instant",
            systemPrompt: "Review code for bugs and improvements.",
            temperature: 0.3,
            maxTokens: 1024,
            estimatedCredits: 0.004,
            config: {},
          },
        },
        {
          id: "n3",
          type: "output",
          position: { x: 700, y: 180 },
          data: { label: "Report", outputType: "text", config: {} },
        },
      ],
      edges: [
        { id: "e1", source: "n1", target: "n2", animated: true },
        { id: "e2", source: "n2", target: "n3", animated: true },
      ],
    },
  },
];

async function ensureTemplates() {
  const count = await AgentTemplate.countDocuments();
  if (count === 0) {
    await AgentTemplate.insertMany(DEFAULT_TEMPLATES);
  }
}

router.use(requireAuth);

router.get("/", async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Number(req.query.limit) || 20);
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    Workflow.find({ userId: req.user.userId }).sort({ updatedAt: -1 }).skip(skip).limit(limit).lean(),
    Workflow.countDocuments({ userId: req.user.userId }),
  ]);
  res.json({ success: true, data: { items, total, page, limit } });
});

router.post("/", async (req, res) => {
  const { name, description } = sanitizeWorkflowPayload(req.body);
  const workflow = await Workflow.create({
    userId: req.user.userId,
    name: name || "Untitled Workflow",
    description: description || "",
    nodes: [],
    edges: [],
  });
  res.status(201).json({ success: true, data: workflow });
});

router.get("/:id", attachWorkflowOwner, async (req, res) => {
  res.json({ success: true, data: req.workflow });
});

router.put("/:id", attachWorkflowOwner, async (req, res) => {
  const clean = sanitizeWorkflowPayload(req.body);
  const updated = await Workflow.findOneAndUpdate(
    { _id: req.params.id, userId: req.user.userId },
    {
      $set: {
        name: clean.name || req.workflow.name,
        description: clean.description ?? req.workflow.description,
        nodes: clean.nodes,
        edges: clean.edges,
      },
    },
    { new: true }
  );
  res.json({ success: true, data: updated });
});

router.delete("/:id", attachWorkflowOwner, async (req, res) => {
  await Workflow.findOneAndUpdate(
    { _id: req.params.id, userId: req.user.userId },
    { $set: { deletedAt: new Date() } }
  );
  res.json({ success: true, data: { deleted: true } });
});

router.post("/:id/duplicate", attachWorkflowOwner, async (req, res) => {
  const copy = await Workflow.create({
    userId: req.user.userId,
    name: `Copy of ${req.workflow.name}`,
    description: req.workflow.description,
    nodes: req.workflow.nodes,
    edges: req.workflow.edges,
    status: "draft",
  });
  res.status(201).json({ success: true, data: copy });
});

router.post("/:id/estimate", attachWorkflowOwner, async (req, res) => {
  const estimate = estimateRunCost(req.workflow);
  const validation = validateDAG(req.workflow.nodes, req.workflow.edges);
  const recipient =
    process.env.X402_CONTRACT_ADDRESS ||
    process.env.TREASURY_WALLET ||
    process.env.RECEIVER_WALLET ||
    "";
  res.json({
    success: true,
    data: {
      ...estimate,
      valid: validation.valid,
      errors: validation.errors,
      recipient,
    },
  });
});

router.post(
  "/:id/run",
  runLimiter,
  attachWorkflowOwner,
  workflowPaymentGate,
  async (req, res) => {
    const validation = validateDAG(req.workflow.nodes, req.workflow.edges);
    if (!validation.valid) {
      return res.status(400).json({ success: false, error: validation.errors.join("; ") });
    }

    const { estimatedCredits } = estimateRunCost(req.workflow);
    const idempotencyKey = req.body?.idempotencyKey || req.body?.runId;
    if (idempotencyKey) {
      const existing = await WorkflowRun.findOne({ idempotencyKey });
      if (existing) {
        return res.status(409).json({ success: false, error: "Duplicate run request" });
      }
    }

    if (!req.body?.paymentProof) {
      const challenge = createPaymentChallenge(
        req.user.userId,
        req.workflow._id,
        "pending",
        estimatedCredits
      );
      return res.status(402).json({
        success: false,
        error: "Insufficient balance or payment required",
        paymentRequired: challenge,
        estimatedCredits,
      });
    }

    const verified = await verifyAndCharge({
      paymentProof: req.body.paymentProof,
      challenge: createPaymentChallenge(req.user.userId, req.workflow._id, "run", estimatedCredits),
      estimatedCredits,
    });
    if (!verified.success) {
      return res.status(402).json({ success: false, error: verified.error || "Payment failed" });
    }

    const run = await WorkflowRun.create({
      workflowId: req.workflow._id,
      userId: req.user.userId,
      status: "pending",
      estimatedCredits,
      walletAddress: req.user.walletAddress,
      txHash: verified.txHash,
      triggeredBy: req.body?.triggeredBy || "manual",
      idempotencyKey: idempotencyKey || undefined,
    });

    setImmediate(() => {
      executeWorkflow(req.workflow._id, run._id, req.user.userId).catch((e) => {
        console.error("[workflow run]", e.message);
      });
    });

    res.status(202).json({
      success: true,
      data: { runId: run._id, estimatedCredits, streamUrl: `/api/studio/workflow-runs/${run._id}/stream` },
    });
  }
);

/** Workflow run history */
const runsRouter = Router();
runsRouter.use(requireAuth);

runsRouter.get("/", async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Number(req.query.limit) || 20);
  const skip = (page - 1) * limit;
  const filter = { userId: req.user.userId };
  const [items, total] = await Promise.all([
    WorkflowRun.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    WorkflowRun.countDocuments(filter),
  ]);
  const workflowIds = [...new Set(items.map((r) => String(r.workflowId)))];
  const workflows = await Workflow.find({ _id: { $in: workflowIds } }).select("name").lean();
  const nameMap = Object.fromEntries(workflows.map((w) => [String(w._id), w.name]));
  const enriched = items.map((r) => ({
    ...r,
    workflowName: nameMap[String(r.workflowId)] || "Workflow",
  }));
  res.json({ success: true, data: { items: enriched, total, page, limit } });
});

runsRouter.get("/:runId", async (req, res) => {
  const run = await WorkflowRun.findOne({
    _id: req.params.runId,
    userId: req.user.userId,
  }).lean();
  if (!run) return res.status(404).json({ success: false, error: "Run not found" });
  res.json({ success: true, data: run });
});

runsRouter.get("/:runId/stream", async (req, res) => {
  const run = await WorkflowRun.findOne({
    _id: req.params.runId,
    userId: req.user.userId,
  });
  if (!run) return res.status(404).json({ success: false, error: "Run not found" });

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  res.write(`data: ${JSON.stringify({ type: "connected", runId: run._id, status: run.status })}\n\n`);
  subscribeRun(run._id, res);

  if (run.status === "completed" || run.status === "failed") {
    res.write(
      `data: ${JSON.stringify({
        type: "complete",
        status: run.status,
        totalCredits: run.totalCreditsDeducted,
        totalTokens: run.totalTokensUsed,
        runtimeMs: run.runtimeMs,
      })}\n\n`
    );
  }
});

const templatesRouter = Router();

templatesRouter.get("/", async (req, res) => {
  await ensureTemplates();
  const now = Date.now();
  if (!templateCache.data || now - templateCache.at > TEMPLATE_CACHE_MS) {
    templateCache = {
      at: now,
      data: await AgentTemplate.find({}).sort({ isFeatured: -1, usageCount: -1 }).lean(),
    };
  }
  let list = templateCache.data;
  const category = req.query.category;
  if (category && category !== "All") {
    list = list.filter((t) => t.category === category);
  }
  res.json({ success: true, data: list });
});

templatesRouter.post("/:id/duplicate", requireAuth, async (req, res) => {
  const tpl = await AgentTemplate.findById(req.params.id);
  if (!tpl) return res.status(404).json({ success: false, error: "Template not found" });
  const workflow = await Workflow.create({
    userId: req.user.userId,
    name: tpl.name,
    description: tpl.description,
    nodes: tpl.nodeStructure?.nodes || [],
    edges: tpl.nodeStructure?.edges || [],
  });
  await AgentTemplate.updateOne({ _id: tpl._id }, { $inc: { usageCount: 1 } });
  templateCache.at = 0;
  res.status(201).json({ success: true, data: workflow });
});

export { router as workflowsRouter, runsRouter, templatesRouter };
