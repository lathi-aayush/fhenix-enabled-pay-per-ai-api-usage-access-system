import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { checkBlogQuota } from "../middleware/studioQuota.js";
import * as studio from "../controllers/studio.controller.js";
import * as studioSubscription from "../controllers/studioSubscription.controller.js";
import { workflowsRouter, runsRouter, templatesRouter } from "./workflows.js";
import clipcraftRoutes from "../studio/clipcraft/routes/clipcraft.routes.js";

const router = Router();

/** ClipCraft — AI Studio clip pipeline */
router.use("/clipcraft", clipcraftRoutes);

router.use(requireAuth);

/** Workflow Studio (also mounted at /api/workflows for direct access) */
router.use("/workflows", workflowsRouter);
router.use("/workflow-runs", runsRouter);
router.use("/workflow-templates", templatesRouter);
router.get("/usage", studio.getUsage);
router.post("/subscription/upgrade", studioSubscription.postSubscriptionUpgrade);

router.post("/blog/generate", checkBlogQuota, studio.postGenerateStream);
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
