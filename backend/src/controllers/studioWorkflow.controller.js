import { incrementPromptUsage } from "../services/blog.service.js";
import {
  friendlyWorkflowError,
  runPromptToImageWorkflow,
  runThumbnailPromptWorkflow,
} from "../services/studioPromptImageWorkflow.js";

export async function postCreativeWorkflow(req, res) {
  const {
    workflowType = "prompt-to-image",
    goal,
    videoTitle,
    existingPrompt,
    category,
    mode,
    type,
    extraInstructions,
    template,
    aspectRatio = "16:9",
    generateImage = true,
    generateImages = true,
    style,
    emotion,
    platform,
    colorTheme,
    thumbnailText,
    faceExpression,
    viralIntensity,
  } = req.body;

  const resolvedGoal = goal?.trim() || videoTitle?.trim();
  if (!resolvedGoal && !existingPrompt?.trim()) {
    return res.status(400).json({ error: "goal, videoTitle, or existingPrompt is required" });
  }

  const input = {
    goal: resolvedGoal,
    videoTitle: videoTitle?.trim() || resolvedGoal,
    existingPrompt,
    category,
    mode,
    type,
    extraInstructions,
    template,
    aspectRatio,
    generateImage,
    generateImages,
    style,
    emotion,
    platform,
    colorTheme,
    thumbnailText,
    faceExpression,
    viralIntensity,
  };

  try {
    const result =
      workflowType === "prompt-to-thumbnail"
        ? await runThumbnailPromptWorkflow(input)
        : await runPromptToImageWorkflow(input);

    await incrementPromptUsage(req.user.userId);
    res.json({ result });
  } catch (e) {
    console.error("[studio creative workflow]", e);
    res.status(500).json({ error: friendlyWorkflowError(e) });
  }
}
