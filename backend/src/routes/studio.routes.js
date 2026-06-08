import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { checkBlogQuota, checkStudioCredits } from "../middleware/studioQuota.js";
import { conditionalX402Gate } from "../middleware/x402OverageGate.js";
import * as studio from "../controllers/studio.controller.js";
import * as studioSubscription from "../controllers/studioSubscription.controller.js";
import * as studioPrompt from "../controllers/studioPrompt.controller.js";
import * as studioThumbnail from "../controllers/studioThumbnail.controller.js";
import * as studioWorkflow from "../controllers/studioWorkflow.controller.js";
import agenticPipelineRoutes from "./agenticPipeline.routes.js";
import { workflowsRouter, runsRouter, templatesRouter } from "./workflows.js";
import clipcraftRoutes from "../studio/clipcraft/routes/clipcraft.routes.js";
import cogsReportRouter from "./admin/cogsReport.js";

const router = Router();

/** ClipCraft — AI Studio clip pipeline */
router.use("/clipcraft", clipcraftRoutes);

/** Public: browse workflow templates without signing in (duplicate still requires auth) */
router.use("/workflow-templates", templatesRouter);

router.use(requireAuth);

/** Workflow Studio (also mounted at /api/workflows for direct access) */
router.use("/workflows", workflowsRouter);
router.use("/workflow-runs", runsRouter);
router.get("/usage", studio.getUsage);
router.post("/subscription/upgrade", studioSubscription.postSubscriptionUpgrade);
router.use("/admin", cogsReportRouter);

const studioRunChain = (defaultRunType) => [
  checkStudioCredits(defaultRunType),
  conditionalX402Gate,
];

router.post("/prompt/generate", ...studioRunChain("prompt_single"), studioPrompt.postPromptGenerate);
router.post("/prompt/enhance", ...studioRunChain("prompt_single"), studioPrompt.postPromptEnhance);
router.post("/prompt/improve", ...studioRunChain("prompt_single"), studioPrompt.postPromptImprove);
router.post("/prompt/analyze", ...studioRunChain("prompt_single"), studioPrompt.postPromptAnalyze);
router.post("/prompt/variations", ...studioRunChain("prompt_single"), studioPrompt.postPromptVariations);

router.post("/thumbnail/generate", ...studioRunChain("workflow_creative"), studioThumbnail.postThumbnailGenerate);
router.post("/thumbnail/variations", ...studioRunChain("workflow_creative"), studioThumbnail.postThumbnailVariations);
router.post(
  "/thumbnail/regenerate-image",
  ...studioRunChain("workflow_creative"),
  studioThumbnail.postThumbnailRegenerateImage
);

router.post("/workflow/creative", ...studioRunChain("workflow_creative"), studioWorkflow.postCreativeWorkflow);

router.use("/agentic", agenticPipelineRoutes);

router.post("/blog/generate", checkBlogQuota, ...studioRunChain("blog_draft"), studio.postGenerateStream);
router.post("/blog/save", studio.postBlogSave);
router.post("/blog/metadata", studio.postBlogMetadata);
router.post("/blog/schedule", studio.postBlogSchedule);
router.get("/drafts", studio.listDrafts);
router.get("/published", studio.listPublished);
router.get("/blog/:id", studio.getBlog);
router.patch("/blog/:id", studio.patchBlog);
router.delete("/blog/:id", studio.deleteBlog);

router.get("/projects", studio.listProjects);
router.post("/projects", studio.createProject);
router.get("/projects/:id", studio.getProject);
router.patch("/projects/:id", studio.patchProject);
router.delete("/projects/:id", studio.deleteProject);

router.get("/platforms", studio.listPlatforms);
router.get("/platforms/setup", studio.getPlatformSetup);
router.post("/platforms/connect", studio.connectPlatform);
router.delete("/platforms/:id", studio.disconnectPlatform);

router.get("/analytics", studio.getStudioAnalytics);
router.get("/calendar", studio.getCalendar);

export default router;
