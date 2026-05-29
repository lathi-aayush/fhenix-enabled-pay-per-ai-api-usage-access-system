import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  generateThumbnailStrategy,
  regenerateThumbnailVariations,
  regenerateThumbnailMainImage,
  friendlyThumbnailError,
} from "../../api/thumbnailApi.js";
import { runCreativeWorkflow, friendlyWorkflowError } from "../../api/creativeWorkflowApi.js";
import { DEFAULT_FORM, HISTORY_KEY } from "./constants.js";

function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(entry) {
  const prev = loadHistory();
  const next = [entry, ...prev].slice(0, 12);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  return next;
}

export function formatExportText(result) {
  if (!result) return "";
  return [
    "# Viral Thumbnail AI Export",
    `Generated: ${result.generatedAt || new Date().toISOString()}`,
    "",
    "## Concept",
    result.concept?.main,
    result.concept?.scene,
    "",
    "## Hook",
    result.thumbnailText?.mainHook,
    "",
    "## Image prompt",
    result.imagePrompt,
    "",
    "## CTR",
    JSON.stringify(result.ctrAnalysis, null, 2),
  ].join("\n");
}

export function useViralThumbnail({ atCap = false } = {}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(DEFAULT_FORM);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [variationsLoading, setVariationsLoading] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [workflowLoading, setWorkflowLoading] = useState(false);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);
  const [history, setHistory] = useState(loadHistory);

  const updateForm = useCallback((patch) => {
    setForm((prev) => ({ ...prev, ...patch }));
  }, []);

  const runAutomatedWorkflow = useCallback(async () => {
    if (atCap) {
      toast.error("Monthly Studio AI limit reached. Upgrade your plan.");
      return;
    }
    if (!form.videoTitle.trim()) {
      toast.error("Enter a video title first.");
      return;
    }
    setError(null);
    setWorkflowLoading(true);
    setLoading(true);
    setStatus("generating");
    setResult(null);
    try {
      const data = await runCreativeWorkflow({
        workflowType: "prompt-to-thumbnail",
        goal: form.videoTitle.trim(),
        videoTitle: form.videoTitle.trim(),
        style: form.style,
        emotion: form.emotion,
        platform: form.platform,
        colorTheme: form.colorTheme,
        thumbnailText: form.thumbnailText,
        faceExpression: form.faceExpression,
        viralIntensity: form.viralIntensity,
        generateImages: form.generateImages !== false,
      });
      const merged = {
        ...data.result,
        images: data.images,
        imageWarning: data.imageWarning,
        workflowPrompt: data.prompt,
      };
      setResult(merged);
      setStatus("completed");
      const entry = {
        id: `${Date.now()}`,
        title: form.videoTitle.slice(0, 80),
        savedAt: new Date().toISOString(),
        form: { ...form },
        result: merged,
      };
      setHistory(saveHistory(entry));
      queryClient.invalidateQueries({ queryKey: ["studio-usage"] });
      toast.success(merged.images?.main ? "Automated workflow complete" : "Strategy ready (image failed)");
    } catch (err) {
      const msg = friendlyWorkflowError(err);
      setError(msg);
      setStatus("error");
      toast.error(msg);
    } finally {
      setWorkflowLoading(false);
      setLoading(false);
    }
  }, [form, atCap, queryClient]);

  const runGenerate = useCallback(async () => {
    if (atCap) {
      toast.error("Monthly Studio AI limit reached. Upgrade your plan.");
      return;
    }
    if (!form.videoTitle.trim()) {
      toast.error("Enter a video title first.");
      return;
    }
    setError(null);
    setLoading(true);
    setStatus("generating");
    setResult(null);
    try {
      const data = await generateThumbnailStrategy(form);
      setResult(data);
      setStatus("completed");
      const entry = {
        id: `${Date.now()}`,
        title: form.videoTitle.slice(0, 80),
        savedAt: new Date().toISOString(),
        form: { ...form },
        result: data,
      };
      setHistory(saveHistory(entry));
      queryClient.invalidateQueries({ queryKey: ["studio-usage"] });
      toast.success(data?.images?.main ? "Thumbnail image ready" : "Thumbnail strategy ready");
    } catch (err) {
      const msg = friendlyThumbnailError(err);
      setError(msg);
      setStatus("error");
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [form, atCap, queryClient]);

  const runRegenerateVariations = useCallback(async () => {
    if (!result || atCap) return;
    setVariationsLoading(true);
    try {
      const data = await regenerateThumbnailVariations(form, result);
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ["studio-usage"] });
      toast.success("Variations updated");
    } catch (err) {
      toast.error(friendlyThumbnailError(err));
    } finally {
      setVariationsLoading(false);
    }
  }, [form, result, atCap, queryClient]);

  const runRegenerateMainImage = useCallback(async () => {
    if (!result || atCap) return;
    setImageLoading(true);
    try {
      const data = await regenerateThumbnailMainImage(form, result);
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ["studio-usage"] });
      toast.success("Thumbnail image regenerated");
    } catch (err) {
      toast.error(friendlyThumbnailError(err));
    } finally {
      setImageLoading(false);
    }
  }, [form, result, atCap, queryClient]);

  const downloadMainImage = useCallback(() => {
    const url = result?.images?.main?.dataUrl;
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = "viral-thumbnail.png";
    a.click();
    toast.success("Download started");
  }, [result]);

  const copyAll = useCallback(async () => {
    const t = formatExportText(result);
    if (!t) return;
    await navigator.clipboard.writeText(t);
    toast.success("Copied full strategy");
  }, [result]);

  const exportPrompt = useCallback(() => {
    if (!result?.imagePrompt) return;
    const blob = new Blob([result.imagePrompt], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "thumbnail-image-prompt.txt";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported image prompt");
  }, [result]);

  const saveResult = useCallback(() => {
    if (!result) return;
    const entry = {
      id: `${Date.now()}`,
      title: form.videoTitle.slice(0, 80) || "Untitled",
      savedAt: new Date().toISOString(),
      form: { ...form },
      result,
    };
    setHistory(saveHistory(entry));
    toast.success("Saved to history");
  }, [result, form]);

  const selectHistory = useCallback((item) => {
    if (item.form) setForm(item.form);
    if (item.result) setResult(item.result);
    toast.success("Loaded from history");
  }, []);

  const clearHistory = useCallback(() => {
    localStorage.removeItem(HISTORY_KEY);
    setHistory([]);
    toast.success("History cleared");
  }, []);

  return {
    form,
    updateForm,
    result,
    loading,
    variationsLoading,
    imageLoading,
    status,
    error,
    setError,
    history,
    runGenerate,
    runAutomatedWorkflow,
    workflowLoading,
    runRegenerateVariations,
    runRegenerateMainImage,
    downloadMainImage,
    copyAll,
    exportPrompt,
    saveResult,
    selectHistory,
    clearHistory,
  };
}
