import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  analyzePrompt,
  enhancePrompt,
  friendlyError,
  generatePrompt,
  generateVariations,
  improvePrompt,
} from "../../api/promptApi.js";
import { runCreativeWorkflow, friendlyWorkflowError } from "../../api/creativeWorkflowApi.js";

function invalidateUsage(queryClient) {
  queryClient.invalidateQueries({ queryKey: ["studio-usage"] });
}

const DEFAULT_FORM = {
  goal: "",
  category: "General",
  mode: "advanced",
  type: "Instruction",
  extraInstructions: "",
  templateLabel: "",
};

export function usePromptGenerator({ atCap = false } = {}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(DEFAULT_FORM);
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState(null);

  const [enhanceEnabled, setEnhanceEnabled] = useState(false);
  const [existingPrompt, setExistingPrompt] = useState("");
  const [enhancedBlock, setEnhancedBlock] = useState("");

  const [analysis, setAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [workflowLoading, setWorkflowLoading] = useState(false);
  const [workflowResult, setWorkflowResult] = useState(null);

  const updateForm = useCallback((patch) => {
    setForm((prev) => ({ ...prev, ...patch }));
  }, []);

  const applyTemplate = useCallback((template) => {
    setForm((prev) => ({
      ...prev,
      goal: template.goal,
      category: template.category,
      type: template.type,
      templateLabel: template.label,
    }));
    toast.success(`Template: ${template.label}`);
  }, []);

  const runGenerate = useCallback(async () => {
    if (atCap) {
      toast.error("Monthly prompt limit reached. Upgrade your plan.");
      return;
    }
    if (!form.goal.trim()) {
      toast.error("Enter a prompt goal first.");
      return;
    }
    setError(null);
    setLoading(true);
    setStreaming(true);
    setOutput("");
    try {
      const full = await generatePrompt(
        {
          goal: form.goal.trim(),
          category: form.category,
          mode: form.mode,
          type: form.type,
          extraInstructions: form.extraInstructions,
          template: form.templateLabel,
        },
        (_chunk, accumulated) => setOutput(accumulated)
      );
      setOutput(full);
      invalidateUsage(queryClient);
      toast.success("Prompt generated");
    } catch (err) {
      const msg = friendlyError(err);
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
      setStreaming(false);
    }
  }, [form, atCap, queryClient]);

  const runEnhance = useCallback(async () => {
    if (atCap) {
      toast.error("Monthly prompt limit reached. Upgrade your plan.");
      return;
    }
    if (!existingPrompt.trim()) {
      toast.error("Paste a prompt to enhance.");
      return;
    }
    setError(null);
    setLoading(true);
    setStreaming(true);
    setEnhancedBlock("");
    try {
      const full = await enhancePrompt(existingPrompt.trim(), (_c, acc) => setEnhancedBlock(acc));
      setEnhancedBlock(full);
      invalidateUsage(queryClient);
      toast.success("Prompt enhanced");
    } catch (err) {
      const msg = friendlyError(err);
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
      setStreaming(false);
    }
  }, [existingPrompt, atCap, queryClient]);

  const runAnalyze = useCallback(async (text) => {
    if (atCap) {
      toast.error("Monthly prompt limit reached. Upgrade your plan.");
      return;
    }
    const target = text?.trim() || output.trim() || existingPrompt.trim();
    if (!target) {
      toast.error("Generate or paste a prompt to analyze.");
      return;
    }
    setAnalyzing(true);
    setError(null);
    try {
      const result = await analyzePrompt(target);
      setAnalysis(result);
      invalidateUsage(queryClient);
    } catch (err) {
      const msg = friendlyError(err);
      setError(msg);
      toast.error(msg);
    } finally {
      setAnalyzing(false);
    }
  }, [output, existingPrompt, atCap, queryClient]);

  const runImprove = useCallback(
    async (textOverride) => {
      if (atCap) {
        toast.error("Monthly prompt limit reached. Upgrade your plan.");
        return;
      }
      const source = textOverride?.trim() || (enhanceEnabled ? enhancedBlock : output).trim();
      if (!source) {
        toast.error("Generate a prompt first.");
        return;
      }
      setLoading(true);
      setStreaming(true);
      setError(null);
      const setter = enhanceEnabled ? setEnhancedBlock : setOutput;
      try {
        const full = await improvePrompt(source, (_c, acc) => setter(acc));
        setter(full);
        invalidateUsage(queryClient);
        toast.success("Prompt improved");
      } catch (err) {
        const msg = friendlyError(err);
        setError(msg);
        toast.error(msg);
      } finally {
        setLoading(false);
        setStreaming(false);
      }
    },
    [output, enhancedBlock, enhanceEnabled, atCap, queryClient]
  );

  const runVariations = useCallback(
    async (textOverride) => {
      if (atCap) {
        toast.error("Monthly prompt limit reached. Upgrade your plan.");
        return;
      }
      const source = textOverride?.trim() || (enhanceEnabled ? enhancedBlock : output).trim();
      if (!source) {
        toast.error("Generate a prompt first.");
        return;
      }
      setLoading(true);
      setError(null);
      const setter = enhanceEnabled ? setEnhancedBlock : setOutput;
      try {
        const vars = await generateVariations(source, 3);
        setter(vars);
        invalidateUsage(queryClient);
        toast.success("Variations ready");
      } catch (err) {
        const msg = friendlyError(err);
        setError(msg);
        toast.error(msg);
      } finally {
        setLoading(false);
      }
    },
    [output, enhancedBlock, enhanceEnabled, atCap, queryClient]
  );

  const copyToClipboard = useCallback(async (text) => {
    const t = text || output;
    if (!t.trim()) return;
    try {
      await navigator.clipboard.writeText(t);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Copy failed");
    }
  }, [output]);

  const downloadMarkdown = useCallback((text, filename = "sentinal-prompt.md") => {
    const t = text || output;
    if (!t.trim()) return;
    const blob = new Blob([t], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Downloaded");
  }, [output]);

  const resetOutput = useCallback(() => {
    setOutput("");
    setEnhancedBlock("");
    setAnalysis(null);
    setError(null);
    setWorkflowResult(null);
  }, []);

  const getActivePromptText = useCallback(() => {
    if (enhanceEnabled && enhancedBlock.trim()) return enhancedBlock;
    return output;
  }, [enhanceEnabled, enhancedBlock, output]);

  const openCreativeWorkflow = useCallback(
    (promptOverride) => {
      const text = (promptOverride || getActivePromptText() || "").trim();
      const params = new URLSearchParams();
      if (text) params.set("prompt", text.slice(0, 12000));
      else if (form.goal.trim()) params.set("goal", form.goal.trim());
      else {
        toast.error("Generate a prompt first, or enter a goal.");
        return;
      }
      navigate(`/studio/creative-workflow?${params.toString()}`);
    },
    [form.goal, getActivePromptText, navigate]
  );

  const runPromptToImage = useCallback(async () => {
    if (atCap) {
      toast.error("Monthly prompt limit reached.");
      return;
    }
    const text = getActivePromptText().trim();
    if (!text && !form.goal.trim()) {
      toast.error("Generate a prompt or enter a goal first.");
      return;
    }
    setWorkflowLoading(true);
    setWorkflowResult(null);
    try {
      const data = await runCreativeWorkflow({
        workflowType: "prompt-to-image",
        goal: form.goal.trim() || "Image from Studio prompt",
        existingPrompt: text || undefined,
        category: form.category,
        mode: form.mode,
        type: form.type,
        extraInstructions: form.extraInstructions,
        generateImage: true,
      });
      setWorkflowResult(data);
      invalidateUsage(queryClient);
      if (data?.image?.dataUrl) toast.success("Image generated");
      else if (data?.imageWarning) toast.error(data.imageWarning);
    } catch (err) {
      toast.error(friendlyWorkflowError(err));
    } finally {
      setWorkflowLoading(false);
    }
  }, [atCap, form, getActivePromptText, queryClient]);

  return {
    form,
    updateForm,
    applyTemplate,
    output,
    setOutput,
    loading,
    streaming,
    error,
    setError,
    enhanceEnabled,
    setEnhanceEnabled,
    existingPrompt,
    setExistingPrompt,
    enhancedBlock,
    analysis,
    analyzing,
    runGenerate,
    runEnhance,
    runAnalyze,
    runImprove,
    runVariations,
    copyToClipboard,
    downloadMarkdown,
    resetOutput,
    workflowLoading,
    workflowResult,
    runPromptToImage,
    openCreativeWorkflow,
  };
}
