import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { runCreativeWorkflow, friendlyWorkflowError } from "../../api/creativeWorkflowApi.js";
import { PROMPT_CATEGORIES, PROMPT_MODES, PROMPT_TYPES } from "../prompt-generator/promptConstants.js";
import { THUMBNAIL_STYLES, EMOTIONS, PLATFORMS, FACE_OPTIONS } from "../viral-thumbnail/constants.js";

export const WORKFLOW_TYPES = [
  { id: "prompt-to-image", label: "Prompt → Image", desc: "Generate a prompt, then render an image" },
  {
    id: "prompt-to-thumbnail",
    label: "Prompt → Thumbnail",
    desc: "Generate a prompt, thumbnail strategy, then 16:9 preview",
  },
];

const DEFAULT_FORM = {
  workflowType: "prompt-to-image",
  goal: "",
  category: "Image Generation",
  mode: "advanced",
  type: "Creative Writing",
  extraInstructions: "",
  aspectRatio: "16:9",
  generateImage: true,
  style: "Cinematic",
  emotion: "Curiosity",
  platform: "YouTube",
  colorTheme: "",
  thumbnailText: "",
  faceExpression: "Yes",
  viralIntensity: 7,
};

export function useCreativeWorkflow({ atCap = false } = {}) {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState(DEFAULT_FORM);
  const [existingPrompt, setExistingPrompt] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeStep, setActiveStep] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const type = searchParams.get("type");
    const goal = searchParams.get("goal");
    const prompt = searchParams.get("prompt");
    const patch = {};
    if (type === "thumbnail" || type === "prompt-to-thumbnail") {
      patch.workflowType = "prompt-to-thumbnail";
    }
    if (goal) patch.goal = goal;
    if (Object.keys(patch).length) setForm((f) => ({ ...f, ...patch }));
    if (prompt) setExistingPrompt(prompt);
  }, [searchParams]);

  const updateForm = useCallback((patch) => {
    setForm((prev) => ({ ...prev, ...patch }));
  }, []);

  const runWorkflow = useCallback(async () => {
    if (atCap) {
      toast.error("Monthly Studio AI limit reached.");
      return;
    }
    if (!form.goal.trim() && !existingPrompt.trim()) {
      toast.error("Enter a goal or paste an existing prompt.");
      return;
    }

    setError(null);
    setLoading(true);
    setResult(null);
    setActiveStep(
      form.workflowType === "prompt-to-thumbnail" ? "prompt" : "prompt"
    );

    try {
      const payload = {
        workflowType: form.workflowType,
        goal: form.goal.trim(),
        videoTitle: form.goal.trim(),
        existingPrompt: existingPrompt.trim() || undefined,
        category: form.category,
        mode: form.mode,
        type: form.type,
        extraInstructions: form.extraInstructions,
        aspectRatio: form.aspectRatio,
        generateImage: form.generateImage,
        generateImages: form.generateImage,
        style: form.style,
        emotion: form.emotion,
        platform: form.platform,
        colorTheme: form.colorTheme,
        thumbnailText: form.thumbnailText,
        faceExpression: form.faceExpression,
        viralIntensity: form.viralIntensity,
      };

      setActiveStep("image");
      const data = await runCreativeWorkflow(payload);
      setResult(data);
      setActiveStep(null);
      queryClient.invalidateQueries({ queryKey: ["studio-usage"] });

      const hasImage =
        data?.image?.dataUrl || data?.images?.main?.dataUrl;
      if (hasImage) toast.success("Workflow complete — image ready");
      else if (data?.imageWarning) toast.error(data.imageWarning);
      else toast.success("Workflow complete");
    } catch (err) {
      const msg = friendlyWorkflowError(err);
      setError(msg);
      setActiveStep(null);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [form, existingPrompt, atCap, queryClient]);

  const downloadImage = useCallback(() => {
    const url = result?.image?.dataUrl || result?.images?.main?.dataUrl;
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download =
      form.workflowType === "prompt-to-thumbnail"
        ? "thumbnail-workflow.png"
        : "prompt-workflow-image.png";
    a.click();
    toast.success("Download started");
  }, [result, form.workflowType]);

  return {
    form,
    updateForm,
    existingPrompt,
    setExistingPrompt,
    result,
    loading,
    activeStep,
    error,
    setError,
    runWorkflow,
    downloadImage,
    workflowTypes: WORKFLOW_TYPES,
    promptCategories: PROMPT_CATEGORIES,
    promptModes: PROMPT_MODES,
    promptTypes: PROMPT_TYPES,
    thumbnailStyles: THUMBNAIL_STYLES,
    emotions: EMOTIONS,
    platforms: PLATFORMS,
    faceOptions: FACE_OPTIONS,
  };
}
