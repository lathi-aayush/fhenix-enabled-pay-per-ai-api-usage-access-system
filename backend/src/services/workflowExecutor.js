import { Workflow } from "../models/Workflow.js";
import { WorkflowRun } from "../models/WorkflowRun.js";
import { runCompletion, calculateCredits, estimateTokens } from "./groqService.js";
import { emitRunEvent, closeRunStream } from "./workflowRunStream.js";
import { enrichInputValue, isYoutubeUrl } from "./urlEnrichment.js";
import {
  getStructuredSystemSuffix,
  buildStructuredRunResult,
  compactStructuredResult,
  formatStructuredForDisplay,
} from "./structuredOutput.js";
import { publishWorkflowToBlog } from "./workflowBlogService.js";
import { executePromptGenNode, executeImageGenNode } from "./workflowCreativeNodes.js";
import { AGENTIC_NODE_TYPES, formatAgenticNodeOutput } from "./workflowAgenticNodes.js";
import { publishAgenticAssets, publishCreativeImage } from "./gcsAssetService.js";
import { formatCreativeNodeOutput } from "./workflowCreativeNodes.js";

function rawFromContext(text) {
  const m = String(text || "").match(/URL:\s*(https?:\/\/[^\s]+)/i);
  return m?.[1] || text;
}

function logLine(run, msg) {
  const line = `[${new Date().toISOString().slice(11, 19)}] ${msg}`;
  run.logs.push(line);
  emitRunEvent(run._id, { type: "log", line });
}

/** Avoid MongoDB 16MB limit / multi-minute saves after image+audio nodes. */
function compactOutputForStorage(output, nodeType) {
  const raw = String(output || "");
  if (!raw) return "";
  try {
    const p = JSON.parse(raw);
    if (p?.kind === "imageGen" && p.image?.dataUrl && !p.image?.url?.startsWith("http")) {
      p.image = { mimeType: p.image.mimeType, dataUrl: "[inline-image]" };
      return JSON.stringify(p);
    }
    if (typeof p?.kind === "string" && p.kind.startsWith("agentic")) {
      const hasStoredImages =
        Array.isArray(p.images) &&
        p.images.every(
          (img) => img?.url?.startsWith("http") || img?.url?.startsWith("/outputs/")
        );
      if (!hasStoredImages && Array.isArray(p.images)) {
        p.images = p.images.map((_, i) => ({ dataUrl: `[image_${i}]` }));
      }
      const hasStoredAudio =
        p.audio?.url?.startsWith("http") || p.audio?.url?.startsWith("/outputs/");
      if (!hasStoredAudio && p.audio?.dataUrl) {
        p.audio = { mimeType: p.audio.mimeType || "audio/wav", dataUrl: "[inline-audio]" };
      }
      if (typeof p.content === "string" && p.content.length > 8000) {
        p.content = `${p.content.slice(0, 8000)}…`;
      }
      return JSON.stringify(p);
    }
    if (p?.final || p?.steps) {
      return JSON.stringify(compactStructuredResult(p));
    }
  } catch {
    /* plain text */
  }
  if (raw.length > 100_000) return `${raw.slice(0, 100_000)}…[truncated]`;
  return raw;
}

async function persistRun(run, label) {
  try {
    await run.save();
  } catch (err) {
    logLine(run, `Save failed${label ? ` (${label})` : ""}: ${err.message}`);
    throw err;
  }
}

export function validateDAG(nodes, edges) {
  const errors = [];
  const nodeIds = new Set((nodes || []).map((n) => n.id));
  const adj = new Map();
  const inDegree = new Map();
  for (const id of nodeIds) {
    adj.set(id, []);
    inDegree.set(id, 0);
  }
  for (const e of edges || []) {
    if (!nodeIds.has(e.source) || !nodeIds.has(e.target)) {
      errors.push(`Invalid edge ${e.id}: unknown node`);
      continue;
    }
    adj.get(e.source).push(e.target);
    inDegree.set(e.target, (inDegree.get(e.target) || 0) + 1);
  }
  const orphans = [...nodeIds].filter((id) => {
    const hasIn = (edges || []).some((e) => e.target === id);
    const hasOut = (edges || []).some((e) => e.source === id);
    return !hasIn && !hasOut && nodeIds.size > 1;
  });
  if (orphans.length) errors.push(`Orphan node(s): ${orphans.join(", ")}`);

  const queue = [];
  for (const [id, deg] of inDegree) if (deg === 0) queue.push(id);
  let visited = 0;
  const order = [];
  const degCopy = new Map(inDegree);
  const q = [...queue];
  while (q.length) {
    const n = q.shift();
    order.push(n);
    visited += 1;
    for (const next of adj.get(n) || []) {
      degCopy.set(next, degCopy.get(next) - 1);
      if (degCopy.get(next) === 0) q.push(next);
    }
  }
  if (visited !== nodeIds.size) errors.push("Cycle detected");
  return { valid: errors.length === 0, errors, order };
}

export function topologicalSort(nodes, edges) {
  const { valid, errors, order } = validateDAG(nodes, edges);
  if (!valid) throw new Error(errors.join("; "));
  return order;
}

export function buildNodeContext(nodeId, nodeResults) {
  const upstreamOutputs = {};
  for (const r of nodeResults || []) {
    if (r.nodeId !== nodeId && r.output) upstreamOutputs[r.nodeId] = r.output;
  }
  return { upstreamOutputs };
}

async function executeNode(node, context, run, meta = {}) {
  const { nodeMap, completedResults, workflowName, userId } = meta;
  const startedAt = new Date();
  const upstream = Object.values(context.upstreamOutputs || {}).join("\n\n");
  if (node.type === "input") {
    const raw = node.data?.value || node.data?.label || "";
    let output = raw;
    try {
      output = await enrichInputValue(raw, node.data?.inputType);
      if (output !== raw && run) logLine(run, `Enriched YouTube input (${output.length} chars)`);
    } catch (err) {
      output = `${raw}\n\n[YouTube enrichment failed: ${err.message}]`;
      if (run) logLine(run, `YouTube enrichment failed: ${err.message}`);
    }
    return { output, tokensUsed: 0, creditsDeducted: 0, startedAt, completedAt: new Date() };
  }
  if (node.type === "ai") {
    const userMessage = upstream || node.data?.value || "Process this workflow step.";
    const hasYoutubeContent =
      String(userMessage).includes("=== YouTube video") || isYoutubeUrl(rawFromContext(userMessage));
    let systemPrompt = node.data?.systemPrompt || "You are a helpful assistant.";
    if (hasYoutubeContent) {
      const youtubeHint =
        "The user message includes fetched YouTube metadata and/or transcript text. Use only that content. Never say you cannot access external links or videos.";
      systemPrompt = node.data?.systemPrompt
        ? `${systemPrompt}\n\n${youtubeHint}`
        : "You analyze YouTube videos from the transcript and metadata in the user message. Summarize clearly and answer questions using only that text.";
    }
    const outputFormat = node.data?.outputFormat || "summary";
    if (outputFormat !== "plain") {
      systemPrompt += getStructuredSystemSuffix(outputFormat);
    }
    const result = await runCompletion({
      model: node.data?.model,
      systemPrompt,
      userMessage,
      temperature: node.data?.temperature,
      maxTokens: node.data?.maxTokens,
    });
    const credits = calculateCredits(result.tokensUsed);
    return {
      output: result.text,
      tokensUsed: result.tokensUsed,
      creditsDeducted: credits,
      startedAt,
      completedAt: new Date(),
    };
  }
  if (node.type === "logic") {
    if (node.data?.conditionType === "delay") {
      await new Promise((r) => setTimeout(r, Math.min(node.data?.delayMs || 500, 5000)));
    }
    return {
      output: upstream || "true",
      tokensUsed: 0,
      creditsDeducted: 0,
      startedAt,
      completedAt: new Date(),
    };
  }
  if (node.type === "promptGen") {
    const result = await executePromptGenNode(node, upstream);
    if (run) logLine(run, `Prompt Generator completed (${result.creativePayload?.prompt?.length || 0} chars)`);
    return {
      output: result.output,
      displayOutput: result.creativePayload?.prompt || result.output,
      creativePayload: result.creativePayload,
      tokensUsed: result.tokensUsed,
      creditsDeducted: result.creditsDeducted,
      startedAt,
      completedAt: new Date(),
    };
  }
  if (AGENTIC_NODE_TYPES[node.type]) {
    const result = await AGENTIC_NODE_TYPES[node.type](node, upstream);
    if (result.agenticPayload && meta.run?._id) {
      try {
        await publishAgenticAssets(result.agenticPayload, {
          scope: "workflow",
          runId: meta.run._id.toString(),
          nodeId: node.id,
        });
      } catch (pubErr) {
        console.error(`[workflow] asset publish (${node.id}):`, pubErr.message);
        if (run) logLine(run, `Asset upload warning: ${pubErr.message}`);
      }
      result.output = formatAgenticNodeOutput(result.agenticPayload);
      result.displayOutput =
        result.agenticPayload.displayPreview || result.displayOutput;
    }
    const agentLabel = node.data?.label || node.type;
    if (run) logLine(run, `${agentLabel}: ${result.displayOutput?.slice(0, 80) || "done"}`);
    return {
      output: result.output,
      displayOutput: result.displayOutput || result.output,
      agenticPayload: result.agenticPayload,
      tokensUsed: result.tokensUsed,
      creditsDeducted: result.creditsDeducted,
      startedAt,
      completedAt: new Date(),
    };
  }
  if (node.type === "imageGen") {
    const result = await executeImageGenNode(node, upstream);
    if (result.creativePayload && meta.run?._id) {
      await publishCreativeImage(result.creativePayload, {
        runId: meta.run._id.toString(),
        label: node.id,
      });
      result.output = formatCreativeNodeOutput(result.creativePayload);
      result.displayOutput = result.creativePayload.imageUrl
        ? "Image uploaded to GCS"
        : result.displayOutput;
    }
    if (run) {
      logLine(
        run,
        result.creativePayload?.image
          ? "Image Generator completed"
          : `Image Generator warning: ${result.creativePayload?.imageWarning || "no image"}`
      );
    }
    return {
      output: result.output,
      displayOutput: result.displayOutput || result.output,
      creativePayload: result.creativePayload,
      tokensUsed: result.tokensUsed,
      creditsDeducted: result.creditsDeducted,
      startedAt,
      completedAt: new Date(),
    };
  }
  if (node.type === "blog") {
    if (!userId) throw new Error("User context required for blog publish");
    const blogResult = await publishWorkflowToBlog({
      userId,
      projectId: node.data?.projectId,
      upstreamContent: upstream,
      topic: node.data?.topic || node.data?.label,
      tone: node.data?.tone || "professional",
      targetAudience: node.data?.targetAudience || "",
      wordCount: node.data?.wordCount || 1000,
      keywords: node.data?.keywords || [],
      brandVoice: node.data?.brandVoice || "",
      publishMode: node.data?.publishMode || "draft",
      platforms: node.data?.platforms || [],
      scheduledFor: node.data?.scheduledFor || null,
    });
    const tokensUsed = estimateTokens(upstream) + (node.data?.wordCount || 1000);
    const output = JSON.stringify(blogResult, null, 2);
    if (run) logLine(run, `Blog post created: ${blogResult.title} (${blogResult.status})`);
    return {
      output,
      blogPayload: blogResult,
      tokensUsed,
      creditsDeducted: calculateCredits(tokensUsed) + 0.003,
      startedAt,
      completedAt: new Date(),
    };
  }
  if (node.type === "output") {
    const payloadByNodeId = Object.fromEntries(
      (completedResults || [])
        .filter((r) => r.agenticPayload)
        .map((r) => [r.nodeId, r.agenticPayload])
    );
    const nodeResultsForStruct = (completedResults || []).map((r) => ({
      nodeId: r.nodeId,
      status: "completed",
      output: compactOutputForStorage(r.output, nodeMap?.[r.nodeId]?.type),
      tokensUsed: r.tokensUsed ?? 0,
      creditsDeducted: r.creditsDeducted ?? 0,
    }));
    const payload = compactStructuredResult(
      buildStructuredRunResult({
        workflowName,
        nodeResults: nodeResultsForStruct,
        nodeMap,
        outputFormat: node.data?.outputFormat || "summary",
        payloadByNodeId,
      })
    );
    return {
      output: formatStructuredForDisplay(payload),
      structuredPayload: payload,
      tokensUsed: 0,
      creditsDeducted: 0,
      startedAt,
      completedAt: new Date(),
    };
  }
  return { output: upstream, tokensUsed: 0, creditsDeducted: 0, startedAt, completedAt: new Date() };
}

export async function executeWorkflow(workflowId, runId, userId) {
  const workflow = await Workflow.findOne({ _id: workflowId, userId });
  if (!workflow) throw new Error("Workflow not found");

  const validation = validateDAG(workflow.nodes, workflow.edges);
  if (!validation.valid) throw new Error(validation.errors.join("; "));

  const run = await WorkflowRun.findById(runId);
  if (!run) throw new Error("Run not found");

  const order = validation.order.length ? validation.order : workflow.nodes.map((n) => n.id);
  const nodeMap = Object.fromEntries(workflow.nodes.map((n) => [n.id, n]));
  const started = Date.now();
  run.status = "running";
  run.nodeResults = order.map((nodeId) => ({
    nodeId,
    status: "queued",
    output: "",
    tokensUsed: 0,
    creditsDeducted: 0,
    error: null,
  }));
  await persistRun(run, "start");
  logLine(run, "Workflow execution started");

  const completedResults = [];

  try {
    for (const nodeId of order) {
      const node = nodeMap[nodeId];
      if (!node) continue;
      const idx = run.nodeResults.findIndex((r) => r.nodeId === nodeId);
      run.nodeResults[idx].status = "running";
      run.nodeResults[idx].startedAt = new Date();
      await persistRun(run, nodeId);
      emitRunEvent(run._id, {
        nodeId,
        status: "running",
        type: "node",
      });
      logLine(run, `${nodeId} started`);

      try {
        const ctx = buildNodeContext(nodeId, completedResults);
        const result = await executeNode(node, ctx, run, {
          nodeMap,
          completedResults,
          workflowName: workflow.name,
          userId,
          run,
        });
        run.nodeResults[idx].status = "completed";
        run.nodeResults[idx].output = compactOutputForStorage(result.output, node.type);
        run.nodeResults[idx].tokensUsed = result.tokensUsed;
        run.nodeResults[idx].creditsDeducted = result.creditsDeducted;
        run.nodeResults[idx].completedAt = result.completedAt;
        run.nodeResults[idx].error = null;
        run.totalTokensUsed += result.tokensUsed;
        run.totalCreditsDeducted += result.creditsDeducted;
        completedResults.push({
          nodeId,
          output: result.output,
          agenticPayload: result.agenticPayload,
          structuredPayload: result.structuredPayload,
          displayOutput: result.displayOutput,
          tokensUsed: result.tokensUsed,
          creditsDeducted: result.creditsDeducted,
        });
        logLine(run, `${nodeId} completed`);
        emitRunEvent(run._id, {
          type: "node",
          nodeId,
          status: "success",
          nodeType: node.type,
          output: String(result.displayOutput || result.output || "").slice(0, 500),
          tokensUsed: result.tokensUsed,
          creditsDeducted: result.creditsDeducted,
        });
        await persistRun(run, nodeId);
      } catch (nodeErr) {
        run.nodeResults[idx].status = "error";
        run.nodeResults[idx].error = nodeErr.message;
        run.nodeResults[idx].completedAt = new Date();
        run.status = "failed";
        await persistRun(run, nodeId);
        logLine(run, `${nodeId} failed: ${nodeErr.message}`);
        emitRunEvent(run._id, {
          type: "node",
          nodeId,
          status: "error",
          error: nodeErr.message,
        });
        emitRunEvent(run._id, {
          type: "complete",
          status: "failed",
          totalCredits: run.totalCreditsDeducted,
          totalTokens: run.totalTokensUsed,
          runtimeMs: Date.now() - started,
        });
        closeRunStream(run._id);
        return run;
      }
    }

    run.status = "completed";
    run.completedAt = new Date();
    run.runtimeMs = Date.now() - started;

    const outputNode = Object.values(nodeMap).find((n) => n.type === "output");
    const payloadByNodeId = Object.fromEntries(
      completedResults.filter((r) => r.agenticPayload).map((r) => [r.nodeId, r.agenticPayload])
    );
    const outputStep = completedResults.find((r) => nodeMap[r.nodeId]?.type === "output");

    if (outputStep?.structuredPayload) {
      run.structuredResult = outputStep.structuredPayload;
    } else {
      const structInputs = run.nodeResults.map((r) => ({
        nodeId: r.nodeId,
        status: "completed",
        output: r.output,
        tokensUsed: r.tokensUsed ?? 0,
        creditsDeducted: r.creditsDeducted ?? 0,
      }));
      run.structuredResult = compactStructuredResult(
        buildStructuredRunResult({
          workflowName: workflow.name,
          nodeResults: structInputs,
          nodeMap,
          outputFormat: outputNode?.data?.outputFormat || "summary",
          payloadByNodeId,
        })
      );
    }

    let saveOk = true;
    try {
      await persistRun(run, "complete");
    } catch (saveErr) {
      saveOk = false;
      logLine(run, `Save failed (complete): ${saveErr.message}`);
      run.structuredResult = compactStructuredResult(run.structuredResult);
      try {
        await persistRun(run, "complete-retry");
      } catch (retryErr) {
        logLine(run, `Retry save failed: ${retryErr.message}`);
        try {
          run.structuredResult = null;
          await run.save();
        } catch {
          /* leave in-memory state for SSE */
        }
      }
    }

    logLine(run, saveOk ? "Workflow completed" : "Workflow completed (results in panel; DB save partial)");
    emitRunEvent(run._id, {
      type: "complete",
      status: "completed",
      saveWarning: saveOk ? null : "Run finished but database save was trimmed. Results are still shown below.",
      totalCredits: run.totalCreditsDeducted,
      totalTokens: run.totalTokensUsed,
      runtimeMs: run.runtimeMs,
      structuredResult: run.structuredResult,
      nodeResults: run.nodeResults.map((r) => ({
        nodeId: r.nodeId,
        status: r.status === "completed" ? "completed" : r.status,
      })),
    });
    closeRunStream(run._id);
    return run;
  } catch (err) {
    run.status = "failed";
    run.completedAt = new Date();
    run.runtimeMs = Date.now() - started;
    logLine(run, `Fatal: ${err.message}`);
    await run.save();
    emitRunEvent(run._id, { type: "complete", status: "failed", error: err.message });
    closeRunStream(run._id);
    throw err;
  }
}
