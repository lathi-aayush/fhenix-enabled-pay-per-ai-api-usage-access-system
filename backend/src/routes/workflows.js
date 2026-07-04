import { Router } from "express";
import rateLimit from "express-rate-limit";
import sanitizeHtml from "sanitize-html";
import { requireAuth } from "../middleware/auth.js";
import { attachWorkflowOwner } from "../middleware/workflowAuth.js";
import { checkStudioCredits } from "../middleware/studioQuota.js";
import { conditionalX402Gate } from "../middleware/x402OverageGate.js";
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

const CREATIVE_TEMPLATE_NAME = "Creative: Prompt → Image";
const AGENTIC_TEMPLATE_NAME = "Agentic: Script → Images → Video → Audio";

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
  {
    name: "Creative: Prompt → Image",
    category: "Creative",
    description:
      "Automated Studio pipeline — Input goal → Advanced Prompt Generator (Gemini) → Image Generator (16:9)",
    tags: ["creative", "prompt", "image", "gemini", "studio"],
    estimatedCreditsPerRun: 0.012,
    isFeatured: true,
    nodeStructure: {
      nodes: [
        {
          id: "cr_in",
          type: "input",
          position: { x: 60, y: 220 },
          data: {
            label: "Image goal",
            inputType: "text",
            value: "A photorealistic 16:9 hero visual for a fintech SaaS landing page, bold lighting",
            config: {},
          },
        },
        {
          id: "cr_prompt",
          type: "promptGen",
          position: { x: 300, y: 220 },
          data: {
            label: "Prompt Generator",
            category: "Image Generation",
            mode: "advanced",
            type: "Creative Writing",
            extraInstructions: "Optimize for Gemini image generation. Include composition, lighting, and style.",
            estimatedCredits: 0.004,
            config: {},
          },
        },
        {
          id: "cr_image",
          type: "imageGen",
          position: { x: 540, y: 220 },
          data: {
            label: "Image Generator",
            aspectRatio: "16:9",
            estimatedCredits: 0.006,
            config: {},
          },
        },
        {
          id: "cr_out",
          type: "output",
          position: { x: 780, y: 220 },
          data: {
            label: "Result",
            outputType: "structured",
            outputFormat: "summary",
            config: {},
          },
        },
      ],
      edges: [
        { id: "cr_e1", source: "cr_in", target: "cr_prompt", animated: true },
        { id: "cr_e2", source: "cr_prompt", target: "cr_image", animated: true },
        { id: "cr_e3", source: "cr_image", target: "cr_out", animated: true },
      ],
    },
  },
  {
    name: AGENTIC_TEMPLATE_NAME,
    category: "Agentic",
    description:
      "Agentic Pipeline as nodes — goal → script → 3 keyframes → Veo video → TTS voiceover (same agents as Studio Agentic Pipeline)",
    tags: ["agentic", "gemini", "veo", "imagen", "studio", "multimodal"],
    estimatedCreditsPerRun: 0.086,
    isFeatured: true,
    nodeStructure: {
      nodes: [
        {
          id: "ag_in",
          type: "input",
          position: { x: 40, y: 240 },
          data: {
            label: "Launch brief",
            inputType: "text",
            value:
              "Write a cinematic launch script for my fitness app, generate 3 key frame images from the scenes, and narrate the voiceover in a professional tone",
            config: {},
          },
        },
        {
          id: "ag_text",
          type: "agenticText",
          position: { x: 240, y: 240 },
          data: { label: "Agentic · Text", estimatedCredits: 0.008, config: {} },
        },
        {
          id: "ag_image",
          type: "agenticImage",
          position: { x: 440, y: 240 },
          data: { label: "Agentic · Image", imageCount: 3, estimatedCredits: 0.018, config: {} },
        },
        {
          id: "ag_video",
          type: "agenticVideo",
          position: { x: 640, y: 240 },
          data: { label: "Agentic · Video", estimatedCredits: 0.05, config: {} },
        },
        {
          id: "ag_audio",
          type: "agenticAudio",
          position: { x: 840, y: 240 },
          data: { label: "Agentic · Audio", estimatedCredits: 0.01, config: {} },
        },
        {
          id: "ag_out",
          type: "output",
          position: { x: 1040, y: 240 },
          data: {
            label: "Result",
            outputType: "structured",
            outputFormat: "summary",
            config: {},
          },
        },
      ],
      edges: [
        { id: "ag_e1", source: "ag_in", target: "ag_text", animated: true },
        { id: "ag_e2", source: "ag_text", target: "ag_image", animated: true },
        { id: "ag_e3", source: "ag_image", target: "ag_video", animated: true },
        { id: "ag_e4", source: "ag_video", target: "ag_audio", animated: true },
        { id: "ag_e5", source: "ag_audio", target: "ag_out", animated: true },
      ],
    },
  },
  {
    name: "Agentic: Wildlife Cinematic Clip",
    category: "Agentic",
    description:
      "Short nature brief → script → 3 keyframes → Veo motion clip. Great for “bird flying”, landscapes, product B-roll.",
    tags: ["agentic", "video", "nature", "veo", "keyframes"],
    estimatedCreditsPerRun: 0.076,
    isFeatured: true,
    nodeStructure: {
      nodes: [
        {
          id: "wc_in",
          type: "input",
          position: { x: 40, y: 200 },
          data: {
            label: "Scene brief",
            inputType: "text",
            value: "A majestic eagle soaring over misty mountains at golden hour, cinematic slow motion",
            config: {},
          },
        },
        {
          id: "wc_text",
          type: "agenticText",
          position: { x: 260, y: 200 },
          data: { label: "Agentic · Text", estimatedCredits: 0.008, config: {} },
        },
        {
          id: "wc_image",
          type: "agenticImage",
          position: { x: 480, y: 200 },
          data: { label: "Agentic · Image", imageCount: 3, estimatedCredits: 0.018, config: {} },
        },
        {
          id: "wc_video",
          type: "agenticVideo",
          position: { x: 700, y: 200 },
          data: { label: "Agentic · Video", estimatedCredits: 0.05, config: {} },
        },
        {
          id: "wc_out",
          type: "output",
          position: { x: 920, y: 200 },
          data: { label: "Clip package", outputType: "structured", outputFormat: "summary", config: {} },
        },
      ],
      edges: [
        { id: "wc_e1", source: "wc_in", target: "wc_text", animated: true },
        { id: "wc_e2", source: "wc_text", target: "wc_image", animated: true },
        { id: "wc_e3", source: "wc_image", target: "wc_video", animated: true },
        { id: "wc_e4", source: "wc_video", target: "wc_out", animated: true },
      ],
    },
  },
  {
    name: "Agentic: Podcast Voiceover",
    category: "Agentic",
    description: "Write a spoken script from your topic, then generate Gemini TTS narration — no video required.",
    tags: ["agentic", "audio", "podcast", "tts"],
    estimatedCreditsPerRun: 0.02,
    isFeatured: true,
    nodeStructure: {
      nodes: [
        {
          id: "pv_in",
          type: "input",
          position: { x: 60, y: 220 },
          data: {
            label: "Episode topic",
            inputType: "text",
            value: "Explain why consistent habits beat motivation for fitness beginners — 90 second intro",
            config: {},
          },
        },
        {
          id: "pv_text",
          type: "agenticText",
          position: { x: 320, y: 220 },
          data: { label: "Agentic · Text", estimatedCredits: 0.008, config: {} },
        },
        {
          id: "pv_audio",
          type: "agenticAudio",
          position: { x: 580, y: 220 },
          data: { label: "Agentic · Audio", estimatedCredits: 0.01, config: {} },
        },
        {
          id: "pv_out",
          type: "output",
          position: { x: 820, y: 220 },
          data: { label: "Script + audio", outputType: "structured", outputFormat: "summary", config: {} },
        },
      ],
      edges: [
        { id: "pv_e1", source: "pv_in", target: "pv_text", animated: true },
        { id: "pv_e2", source: "pv_text", target: "pv_audio", animated: true },
        { id: "pv_e3", source: "pv_audio", target: "pv_out", animated: true },
      ],
    },
  },
  {
    name: "Agentic: Keyframes Only (Fast)",
    category: "Agentic",
    description: "Script + 3 still keyframes in ~3–5 min — skip Veo video when you only need boards or mood frames.",
    tags: ["agentic", "image", "fast", "storyboard"],
    estimatedCreditsPerRun: 0.028,
    nodeStructure: {
      nodes: [
        {
          id: "kf_in",
          type: "input",
          position: { x: 80, y: 240 },
          data: {
            label: "Creative brief",
            inputType: "text",
            value: "A futuristic electric scooter in neon Tokyo rain, cyberpunk product launch",
            config: {},
          },
        },
        {
          id: "kf_text",
          type: "agenticText",
          position: { x: 340, y: 240 },
          data: { label: "Agentic · Text", estimatedCredits: 0.008, config: {} },
        },
        {
          id: "kf_image",
          type: "agenticImage",
          position: { x: 600, y: 240 },
          data: { label: "Agentic · Image", imageCount: 3, estimatedCredits: 0.018, config: {} },
        },
        {
          id: "kf_out",
          type: "output",
          position: { x: 860, y: 240 },
          data: { label: "Storyboard", outputType: "structured", outputFormat: "summary", config: {} },
        },
      ],
      edges: [
        { id: "kf_e1", source: "kf_in", target: "kf_text", animated: true },
        { id: "kf_e2", source: "kf_text", target: "kf_image", animated: true },
        { id: "kf_e3", source: "kf_image", target: "kf_out", animated: true },
      ],
    },
  },
  {
    name: "Social: Thumbnail + Caption",
    category: "Creative",
    description:
      "YouTube-style pack — Gemini prompt → 16:9 thumbnail image → Groq writes title + description + hashtags.",
    tags: ["youtube", "thumbnail", "social", "creative"],
    estimatedCreditsPerRun: 0.014,
    isFeatured: true,
    nodeStructure: {
      nodes: [
        {
          id: "soc_in",
          type: "input",
          position: { x: 40, y: 200 },
          data: {
            label: "Video topic",
            inputType: "text",
            value: "How I built a pay-per-use AI API on Sepolia in 30 days",
            config: {},
          },
        },
        {
          id: "soc_prompt",
          type: "promptGen",
          position: { x: 260, y: 200 },
          data: {
            label: "Thumbnail prompt",
            category: "Video / YouTube",
            mode: "advanced",
            extraInstructions: "High contrast, bold text hook, expressive face if relevant, 16:9",
            estimatedCredits: 0.004,
            config: {},
          },
        },
        {
          id: "soc_image",
          type: "imageGen",
          position: { x: 480, y: 200 },
          data: { label: "Thumbnail image", aspectRatio: "16:9", estimatedCredits: 0.006, config: {} },
        },
        {
          id: "soc_caption",
          type: "ai",
          position: { x: 700, y: 200 },
          data: {
            label: "Title & caption",
            model: "llama-3.3-70b-versatile",
            systemPrompt:
              "From the topic and thumbnail context, write: 3 click-worthy titles, a 2-paragraph video description, and 12 hashtags. Use markdown sections.",
            outputFormat: "summary",
            maxTokens: 1024,
            estimatedCredits: 0.004,
            config: {},
          },
        },
        {
          id: "soc_out",
          type: "output",
          position: { x: 920, y: 200 },
          data: { label: "Social pack", outputType: "structured", outputFormat: "summary", config: {} },
        },
      ],
      edges: [
        { id: "soc_e1", source: "soc_in", target: "soc_prompt", animated: true },
        { id: "soc_e2", source: "soc_prompt", target: "soc_image", animated: true },
        { id: "soc_e3", source: "soc_image", target: "soc_caption", animated: true },
        { id: "soc_e4", source: "soc_caption", target: "soc_out", animated: true },
      ],
    },
  },
  {
    name: "Research → Executive Report",
    category: "Research",
    description: "Two-pass Groq pipeline — gather facts, then produce an executive report with action items.",
    tags: ["research", "report", "groq"],
    estimatedCreditsPerRun: 0.012,
    isFeatured: true,
    nodeStructure: {
      nodes: [
        {
          id: "res_in",
          type: "input",
          position: { x: 60, y: 220 },
          data: {
            label: "Research question",
            inputType: "text",
            value: "State of micro-payments for AI APIs in 2026 — market size, players, risks",
            config: {},
          },
        },
        {
          id: "res_gather",
          type: "ai",
          position: { x: 300, y: 220 },
          data: {
            label: "Fact gathering",
            model: "llama-3.3-70b-versatile",
            systemPrompt:
              "Research this question thoroughly. Output: key statistics, 6 bullet facts, competitor list, open questions. Be specific; cite plausible public sources by name.",
            outputFormat: "summary",
            maxTokens: 1536,
            temperature: 0.5,
            estimatedCredits: 0.006,
            config: {},
          },
        },
        {
          id: "res_report",
          type: "ai",
          position: { x: 540, y: 220 },
          data: {
            label: "Executive report",
            model: "llama-3.3-70b-versatile",
            systemPrompt:
              "Turn the research notes into an executive report: Overview, Market landscape, Opportunities, Risks, 5 action items. Professional tone.",
            outputFormat: "report",
            maxTokens: 2048,
            temperature: 0.4,
            estimatedCredits: 0.006,
            config: {},
          },
        },
        {
          id: "res_out",
          type: "output",
          position: { x: 780, y: 220 },
          data: { label: "Final report", outputType: "structured", outputFormat: "report", config: {} },
        },
      ],
      edges: [
        { id: "res_e1", source: "res_in", target: "res_gather", animated: true },
        { id: "res_e2", source: "res_gather", target: "res_report", animated: true },
        { id: "res_e3", source: "res_report", target: "res_out", animated: true },
      ],
    },
  },
  {
    name: "YouTube → Short-form Script + Frame",
    category: "Media",
    description: "Pull a YouTube URL, summarize it, write a 30s vertical script, generate one hero keyframe.",
    tags: ["youtube", "shorts", "agentic", "repurpose"],
    estimatedCreditsPerRun: 0.022,
    nodeStructure: {
      nodes: [
        {
          id: "ys_in",
          type: "input",
          position: { x: 40, y: 240 },
          data: { label: "YouTube URL", inputType: "youtube", value: "", config: {} },
        },
        {
          id: "ys_ai",
          type: "ai",
          position: { x: 260, y: 240 },
          data: {
            label: "Summarize video",
            model: "llama-3.3-70b-versatile",
            systemPrompt:
              "From the transcript, extract: hook, 3 key beats, CTA. Format for a 30-second vertical short.",
            outputFormat: "summary",
            maxTokens: 1024,
            estimatedCredits: 0.005,
            config: {},
          },
        },
        {
          id: "ys_text",
          type: "agenticText",
          position: { x: 480, y: 240 },
          data: { label: "Short script", estimatedCredits: 0.008, config: {} },
        },
        {
          id: "ys_image",
          type: "agenticImage",
          position: { x: 700, y: 240 },
          data: { label: "Hero frame", imageCount: 1, estimatedCredits: 0.008, config: {} },
        },
        {
          id: "ys_out",
          type: "output",
          position: { x: 920, y: 240 },
          data: { label: "Short pack", outputType: "structured", outputFormat: "summary", config: {} },
        },
      ],
      edges: [
        { id: "ys_e1", source: "ys_in", target: "ys_ai", animated: true },
        { id: "ys_e2", source: "ys_ai", target: "ys_text", animated: true },
        { id: "ys_e3", source: "ys_text", target: "ys_image", animated: true },
        { id: "ys_e4", source: "ys_image", target: "ys_out", animated: true },
      ],
    },
  },
  {
    name: "Data Task → Python (Sandbox)",
    category: "Code",
    description: "Describe a data task; Gemma writes and runs Python in a sandbox, returns stdout.",
    tags: ["code", "python", "agentic", "automation"],
    estimatedCreditsPerRun: 0.008,
    nodeStructure: {
      nodes: [
        {
          id: "py_in",
          type: "input",
          position: { x: 100, y: 200 },
          data: {
            label: "Task",
            inputType: "text",
            value: "Given sales 120, 150, 98, 200, compute average, max, and percent change from first to last",
            config: {},
          },
        },
        {
          id: "py_code",
          type: "agenticCode",
          position: { x: 420, y: 200 },
          data: { label: "Agentic · Code", estimatedCredits: 0.006, config: {} },
        },
        {
          id: "py_out",
          type: "output",
          position: { x: 720, y: 200 },
          data: { label: "Run result", outputType: "structured", outputFormat: "json", config: {} },
        },
      ],
      edges: [
        { id: "py_e1", source: "py_in", target: "py_code", animated: true },
        { id: "py_e2", source: "py_code", target: "py_out", animated: true },
      ],
    },
  },
  {
    name: "Blog Outline → SEO Post",
    category: "Writing",
    description: "Gemini outlines from a keyword, Groq expands to full SEO article sections, saves via Blog Agent.",
    tags: ["blog", "seo", "writing", "gemini", "groq"],
    estimatedCreditsPerRun: 0.02,
    nodeStructure: {
      nodes: [
        {
          id: "seo_in",
          type: "input",
          position: { x: 40, y: 220 },
          data: {
            label: "Target keyword",
            inputType: "text",
            value: "pay per use AI API blockchain micropayments",
            config: {},
          },
        },
        {
          id: "seo_text",
          type: "agenticText",
          position: { x: 280, y: 220 },
          data: {
            label: "Outline (Gemini)",
            estimatedCredits: 0.008,
            goal: "Create a detailed SEO blog outline with H2s, meta description, and 5 target keywords",
            config: {},
          },
        },
        {
          id: "seo_expand",
          type: "ai",
          position: { x: 520, y: 220 },
          data: {
            label: "Expand article",
            model: "llama-3.3-70b-versatile",
            systemPrompt:
              "Expand the outline into a complete 1200-word SEO blog post with introduction, H2 sections, conclusion, and FAQ. Markdown.",
            outputFormat: "plain",
            maxTokens: 3072,
            temperature: 0.6,
            estimatedCredits: 0.008,
            config: {},
          },
        },
        {
          id: "seo_blog",
          type: "blog",
          position: { x: 760, y: 220 },
          data: {
            label: "Save to Studio",
            tone: "professional",
            wordCount: 1200,
            publishMode: "studio",
            platforms: [],
            config: {},
          },
        },
      ],
      edges: [
        { id: "seo_e1", source: "seo_in", target: "seo_text", animated: true },
        { id: "seo_e2", source: "seo_text", target: "seo_expand", animated: true },
        { id: "seo_e3", source: "seo_expand", target: "seo_blog", animated: true },
      ],
    },
  },
  {
    name: "Creative: Brand Identity Pack",
    category: "Creative",
    description:
      "Brand brief → Gemini prompt engineering → 4 mood images → tagline & voice guidelines via Groq.",
    tags: ["brand", "identity", "creative", "moodboard"],
    estimatedCreditsPerRun: 0.022,
    isFeatured: true,
    nodeStructure: {
      nodes: [
        {
          id: "bi_in",
          type: "input",
          position: { x: 40, y: 220 },
          data: {
            label: "Brand brief",
            inputType: "text",
            value:
              "A pay-per-use AI API marketplace called Sentinel — trustworthy, developer-first, EVM-native. Navy + teal palette.",
            config: {},
          },
        },
        {
          id: "bi_prompt",
          type: "promptGen",
          position: { x: 260, y: 220 },
          data: {
            label: "Visual direction",
            category: "Brand / Identity",
            mode: "advanced",
            extraInstructions: "4 distinct visual directions: hero, UI mockup, abstract, lifestyle. 16:9 each.",
            estimatedCredits: 0.004,
            config: {},
          },
        },
        {
          id: "bi_image",
          type: "imageGen",
          position: { x: 480, y: 220 },
          data: { label: "Mood images", aspectRatio: "16:9", estimatedCredits: 0.008, config: {} },
        },
        {
          id: "bi_voice",
          type: "ai",
          position: { x: 700, y: 220 },
          data: {
            label: "Brand voice",
            model: "llama-3.3-70b-versatile",
            systemPrompt:
              "From the brand brief, write: 5 tagline options, tone-of-voice guidelines (do/don't), and 3 sample microcopy snippets for a developer landing page.",
            outputFormat: "summary",
            maxTokens: 1024,
            estimatedCredits: 0.004,
            config: {},
          },
        },
        {
          id: "bi_out",
          type: "output",
          position: { x: 920, y: 220 },
          data: { label: "Brand pack", outputType: "structured", outputFormat: "summary", config: {} },
        },
      ],
      edges: [
        { id: "bi_e1", source: "bi_in", target: "bi_prompt", animated: true },
        { id: "bi_e2", source: "bi_prompt", target: "bi_image", animated: true },
        { id: "bi_e3", source: "bi_image", target: "bi_voice", animated: true },
        { id: "bi_e4", source: "bi_voice", target: "bi_out", animated: true },
      ],
    },
  },
  {
    name: "Creative: Instagram Carousel",
    category: "Creative",
    description: "Topic → 5 slide copy → Gemini generates one visual per slide (1:1 square).",
    tags: ["instagram", "carousel", "social", "creative"],
    estimatedCreditsPerRun: 0.018,
    isFeatured: true,
    nodeStructure: {
      nodes: [
        {
          id: "ig_in",
          type: "input",
          position: { x: 40, y: 240 },
          data: {
            label: "Carousel topic",
            inputType: "text",
            value: "5 reasons pay-per-use beats monthly AI subscriptions for indie hackers",
            config: {},
          },
        },
        {
          id: "ig_copy",
          type: "ai",
          position: { x: 280, y: 240 },
          data: {
            label: "Slide copy",
            model: "llama-3.3-70b-versatile",
            systemPrompt:
              "Write exactly 5 Instagram carousel slides. Each slide: bold headline (max 8 words) + 1 supporting sentence. Slide 1 = hook, slide 5 = CTA. Number each slide.",
            outputFormat: "summary",
            maxTokens: 768,
            estimatedCredits: 0.004,
            config: {},
          },
        },
        {
          id: "ig_prompt",
          type: "promptGen",
          position: { x: 520, y: 240 },
          data: {
            label: "Visual prompts",
            category: "Social Media",
            mode: "advanced",
            extraInstructions: "One bold 1:1 square graphic prompt per slide. High contrast, minimal text overlay space.",
            estimatedCredits: 0.004,
            config: {},
          },
        },
        {
          id: "ig_image",
          type: "imageGen",
          position: { x: 760, y: 240 },
          data: { label: "Slide visuals", aspectRatio: "1:1", estimatedCredits: 0.008, config: {} },
        },
        {
          id: "ig_out",
          type: "output",
          position: { x: 980, y: 240 },
          data: { label: "Carousel pack", outputType: "structured", outputFormat: "summary", config: {} },
        },
      ],
      edges: [
        { id: "ig_e1", source: "ig_in", target: "ig_copy", animated: true },
        { id: "ig_e2", source: "ig_copy", target: "ig_prompt", animated: true },
        { id: "ig_e3", source: "ig_prompt", target: "ig_image", animated: true },
        { id: "ig_e4", source: "ig_image", target: "ig_out", animated: true },
      ],
    },
  },
  {
    name: "Agentic: SaaS Explainer Video",
    category: "Agentic",
    description:
      "Product brief → script → 3 UI mockup keyframes → Veo motion → professional voiceover. Perfect for landing pages.",
    tags: ["agentic", "saas", "explainer", "video", "voiceover"],
    estimatedCreditsPerRun: 0.086,
    isFeatured: true,
    nodeStructure: {
      nodes: [
        {
          id: "sx_in",
          type: "input",
          position: { x: 40, y: 240 },
          data: {
            label: "Product brief",
            inputType: "text",
            value:
              "Explain Sentinel — a pay-per-use AI API gateway on Sepolia. Show: connect wallet, pick an API, pay per call, get on-chain receipt. 40 seconds, professional tone.",
            config: {},
          },
        },
        {
          id: "sx_text",
          type: "agenticText",
          position: { x: 240, y: 240 },
          data: { label: "Agentic · Text", estimatedCredits: 0.008, config: {} },
        },
        {
          id: "sx_image",
          type: "agenticImage",
          position: { x: 440, y: 240 },
          data: { label: "Agentic · Image", imageCount: 3, estimatedCredits: 0.018, config: {} },
        },
        {
          id: "sx_video",
          type: "agenticVideo",
          position: { x: 640, y: 240 },
          data: { label: "Agentic · Video", estimatedCredits: 0.05, config: {} },
        },
        {
          id: "sx_audio",
          type: "agenticAudio",
          position: { x: 840, y: 240 },
          data: { label: "Agentic · Audio", estimatedCredits: 0.01, config: {} },
        },
        {
          id: "sx_out",
          type: "output",
          position: { x: 1040, y: 240 },
          data: { label: "Explainer pack", outputType: "structured", outputFormat: "summary", config: {} },
        },
      ],
      edges: [
        { id: "sx_e1", source: "sx_in", target: "sx_text", animated: true },
        { id: "sx_e2", source: "sx_text", target: "sx_image", animated: true },
        { id: "sx_e3", source: "sx_image", target: "sx_video", animated: true },
        { id: "sx_e4", source: "sx_video", target: "sx_audio", animated: true },
        { id: "sx_e5", source: "sx_audio", target: "sx_out", animated: true },
      ],
    },
  },
  {
    name: "Creative: Product Demo Storyboard",
    category: "Creative",
    description: "Feature list → scene breakdown → 6 storyboard frames for a product demo video.",
    tags: ["storyboard", "product", "demo", "creative"],
    estimatedCreditsPerRun: 0.016,
    nodeStructure: {
      nodes: [
        {
          id: "sb_in",
          type: "input",
          position: { x: 60, y: 220 },
          data: {
            label: "Feature list",
            inputType: "text",
            value:
              "Protected proxy layer, automated micropayments, usage dashboard, no vendor lock-in, on-chain receipts",
            config: {},
          },
        },
        {
          id: "sb_scenes",
          type: "ai",
          position: { x: 300, y: 220 },
          data: {
            label: "Scene breakdown",
            model: "llama-3.3-70b-versatile",
            systemPrompt:
              "Turn the feature list into a 6-scene product demo storyboard. Each scene: scene number, on-screen action, narration line, duration (seconds). Total ~60s.",
            outputFormat: "summary",
            maxTokens: 1024,
            estimatedCredits: 0.004,
            config: {},
          },
        },
        {
          id: "sb_prompt",
          type: "promptGen",
          position: { x: 540, y: 220 },
          data: {
            label: "Frame prompts",
            category: "Storyboard",
            mode: "advanced",
            extraInstructions: "One cinematic 16:9 frame per scene. UI/product shots where relevant.",
            estimatedCredits: 0.004,
            config: {},
          },
        },
        {
          id: "sb_image",
          type: "imageGen",
          position: { x: 780, y: 220 },
          data: { label: "Storyboard frames", aspectRatio: "16:9", estimatedCredits: 0.008, config: {} },
        },
        {
          id: "sb_out",
          type: "output",
          position: { x: 1000, y: 220 },
          data: { label: "Storyboard", outputType: "structured", outputFormat: "summary", config: {} },
        },
      ],
      edges: [
        { id: "sb_e1", source: "sb_in", target: "sb_scenes", animated: true },
        { id: "sb_e2", source: "sb_scenes", target: "sb_prompt", animated: true },
        { id: "sb_e3", source: "sb_prompt", target: "sb_image", animated: true },
        { id: "sb_e4", source: "sb_image", target: "sb_out", animated: true },
      ],
    },
  },
  {
    name: "Marketing: Competitive Battlecard",
    category: "Research",
    description: "Paste competitor weaknesses → structured battlecard with talk tracks and objection handlers.",
    tags: ["sales", "competitive", "battlecard", "research"],
    estimatedCreditsPerRun: 0.008,
    isFeatured: true,
    nodeStructure: {
      nodes: [
        {
          id: "bc_in",
          type: "input",
          position: { x: 80, y: 220 },
          data: {
            label: "Competitor intel",
            inputType: "text",
            value:
              "Competitor weaknesses: no on-chain payments, monthly lock-in, no usage analytics, complex billing, no proxy layer. Our strengths: pay-per-use, EVM micropayments, transparent dashboard.",
            config: {},
          },
        },
        {
          id: "bc_ai",
          type: "ai",
          position: { x: 400, y: 220 },
          data: {
            label: "Battlecard writer",
            model: "llama-3.3-70b-versatile",
            systemPrompt:
              "Create a sales battlecard: Overview, Our wins (table), Their weaknesses, 5 talk tracks, 5 objection handlers, elevator pitch (30s). Markdown format.",
            outputFormat: "report",
            maxTokens: 2048,
            temperature: 0.4,
            estimatedCredits: 0.006,
            config: {},
          },
        },
        {
          id: "bc_out",
          type: "output",
          position: { x: 720, y: 220 },
          data: { label: "Battlecard", outputType: "structured", outputFormat: "report", config: {} },
        },
      ],
      edges: [
        { id: "bc_e1", source: "bc_in", target: "bc_ai", animated: true },
        { id: "bc_e2", source: "bc_ai", target: "bc_out", animated: true },
      ],
    },
  },
  {
    name: "Agentic: Lo-Fi Product Loop",
    category: "Agentic",
    description: "Minimal brief → 2 aesthetic keyframes → short looping Veo clip for website backgrounds.",
    tags: ["agentic", "loop", "website", "ambient"],
    estimatedCreditsPerRun: 0.068,
    nodeStructure: {
      nodes: [
        {
          id: "lf_in",
          type: "input",
          position: { x: 60, y: 220 },
          data: {
            label: "Loop brief",
            inputType: "text",
            value:
              "Seamless looping background: abstract data streams flowing into a glowing wallet icon, dark navy gradient, subtle particle effects, calm and premium",
            config: {},
          },
        },
        {
          id: "lf_text",
          type: "agenticText",
          position: { x: 300, y: 220 },
          data: { label: "Agentic · Text", estimatedCredits: 0.008, config: {} },
        },
        {
          id: "lf_image",
          type: "agenticImage",
          position: { x: 540, y: 220 },
          data: { label: "Agentic · Image", imageCount: 2, estimatedCredits: 0.012, config: {} },
        },
        {
          id: "lf_video",
          type: "agenticVideo",
          position: { x: 780, y: 220 },
          data: { label: "Agentic · Video", estimatedCredits: 0.05, config: {} },
        },
        {
          id: "lf_out",
          type: "output",
          position: { x: 1000, y: 220 },
          data: { label: "Loop clip", outputType: "structured", outputFormat: "summary", config: {} },
        },
      ],
      edges: [
        { id: "lf_e1", source: "lf_in", target: "lf_text", animated: true },
        { id: "lf_e2", source: "lf_text", target: "lf_image", animated: true },
        { id: "lf_e3", source: "lf_image", target: "lf_video", animated: true },
        { id: "lf_e4", source: "lf_video", target: "lf_out", animated: true },
      ],
    },
  },
];

async function ensureTemplates() {
  const count = await AgentTemplate.countDocuments();
  if (count === 0) {
    await AgentTemplate.insertMany(DEFAULT_TEMPLATES);
    return;
  }
  for (const tpl of DEFAULT_TEMPLATES) {
    const exists = await AgentTemplate.findOne({ name: tpl.name });
    if (!exists) {
      await AgentTemplate.create(tpl);
      templateCache.at = 0;
    }
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
  checkStudioCredits(),
  conditionalX402Gate,
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

    const run = await WorkflowRun.create({
      workflowId: req.workflow._id,
      userId: req.user.userId,
      status: "pending",
      estimatedCredits,
      walletAddress: req.user.walletAddress,
      txHash: req.overageTxId || null,
      triggeredBy: req.body?.triggeredBy || "manual",
      idempotencyKey: idempotencyKey || undefined,
      runType: req.studioRunType,
      paidVia: req.creditDeducted ? "credits" : req.overagePaid ? "x402_overage" : "unknown",
    });

    setImmediate(() => {
      executeWorkflow(req.workflow._id, run._id, req.user.userId).catch((e) => {
        console.error("[workflow run]", e.message);
      });
    });

    res.status(202).json({
      success: true,
      data: {
        runId: run._id,
        estimatedCredits,
        runType: req.studioRunType,
        creditsRemaining: req.creditsRemaining,
        streamUrl: `/api/studio/workflow-runs/${run._id}/stream`,
      },
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
