import { useCallback, useState } from "react";
import toast from "react-hot-toast";
import { api, getApiBase } from "../api/client.js";
import { studioFetch } from "../api/studioFetch.js";
import { WORKFLOW_API } from "../api/workflowApi.js";
import { useNodeExecution } from "../context/NodeExecutionContext.jsx";
import { extractBlogResult } from "../utils/workflowBlog.js";
import { playCompletionSound } from "../utils/completionSound.js";

const STORAGE_KEY = "sentinal_token";

function mapNodeStatus(status) {
  if (status === "completed" || status === "success") return "success";
  if (status === "error") return "error";
  if (status === "running") return "running";
  if (status === "queued") return "queued";
  return null;
}

function syncNodeStatusesFromRun(runData, setNodeStatuses) {
  const statuses = {};
  for (const nr of runData?.nodeResults || []) {
    const mapped = mapNodeStatus(nr.status);
    if (mapped) statuses[nr.nodeId] = mapped;
  }
  setNodeStatuses((prev) => ({ ...prev, ...statuses }));
}

async function streamRunEvents(runId, onEvent) {
  const token = localStorage.getItem(STORAGE_KEY);
  const res = await fetch(`${getApiBase()}${WORKFLOW_API.runStream(runId)}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("Failed to connect to run stream");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() || "";
    for (const part of parts) {
      const line = part.replace(/^data:\s*/, "").trim();
      if (!line) continue;
      try {
        onEvent(JSON.parse(line));
      } catch {
        /* ignore parse errors */
      }
    }
  }
}

export function useWorkflowExecutor(workflowId) {
  const [isRunning, setIsRunning] = useState(false);
  const [currentRun, setCurrentRun] = useState(null);
  const [liveLogs, setLiveLogs] = useState([]);
  const { setNodeStatuses, setRunId } = useNodeExecution();

  const runWorkflow = useCallback(async () => {
    if (!workflowId) return;
    setIsRunning(true);
    setLiveLogs([]);
    setNodeStatuses({});
    let activeRunId = null;

    try {
      const { data: estRes } = await api.post(WORKFLOW_API.estimate(workflowId));
      if (!estRes?.data?.valid) {
        toast.error(estRes?.data?.errors?.join("; ") || "Invalid workflow");
        return;
      }

      const runRes = await studioFetch(WORKFLOW_API.run(workflowId), {
        method: "POST",
        body: { idempotencyKey: `run_${Date.now()}` },
      });
      const runJson = await runRes.json();
      if (!runRes.ok) {
        const msg =
          runJson?.error ||
          (runRes.status === 402
            ? "Payment required. Approve the ETH execution payment in MetaMask."
            : "Run failed");
        throw new Error(msg);
      }

      const runId = runJson?.data?.runId;
      if (!runId) throw new Error("No run id returned");
      activeRunId = runId;
      setRunId(runId);
      window.dispatchEvent(new CustomEvent("studio-usage-changed"));

      setCurrentRun((prev) => ({ ...prev, _id: runId, status: "running" }));

      let heardCompleteEvent = false;

      await streamRunEvents(runId, (evt) => {
        if (evt.type === "log") setLiveLogs((prev) => [...prev, evt.line]);
        if (evt.nodeId && evt.status) {
          const mapped = mapNodeStatus(evt.status) || evt.status;
          setNodeStatuses((prev) => ({ ...prev, [evt.nodeId]: mapped }));
        }
        if (evt.type === "complete") {
          heardCompleteEvent = true;
          setIsRunning(false);
          if (evt.nodeResults?.length) {
            syncNodeStatusesFromRun({ nodeResults: evt.nodeResults }, setNodeStatuses);
          }
          setCurrentRun((prev) => ({
            ...prev,
            _id: runId,
            status: evt.status,
            nodeResults: evt.nodeResults?.length
              ? evt.nodeResults.map((nr) => ({
                  nodeId: nr.nodeId,
                  status: nr.status === "completed" ? "completed" : nr.status,
                  output: prev?.nodeResults?.find((p) => p.nodeId === nr.nodeId)?.output || "",
                }))
              : prev?.nodeResults,
            totalCreditsDeducted: evt.totalCredits ?? prev?.totalCreditsDeducted,
            totalTokensUsed: evt.totalTokens ?? prev?.totalTokensUsed,
            runtimeMs: evt.runtimeMs ?? prev?.runtimeMs,
            structuredResult: evt.structuredResult ?? prev?.structuredResult,
            saveWarning: evt.saveWarning || null,
          }));
          if (evt.status === "completed") {
            playCompletionSound();
            if (evt.saveWarning) {
              toast.error(evt.saveWarning, { duration: 7000 });
            } else {
              toast.success("Workflow complete — results are ready", { duration: 5000 });
            }
          } else {
            toast.error(`Workflow ${evt.status}`);
          }
        }
      });

      const { data: finalRun } = await api.get(WORKFLOW_API.runOne(runId));
      if (finalRun?.success) {
        setCurrentRun(finalRun.data);
        syncNodeStatusesFromRun(finalRun.data, setNodeStatuses);
        const blog = extractBlogResult(finalRun.data);
        if (blog?.blogPostId) {
          if (blog.status === "published") {
            toast.success(`Published: ${blog.title}`, { duration: 6000 });
          } else {
            toast.success(`Blog ready: ${blog.title}`, { duration: 5000 });
          }
        } else if (finalRun.data.status === "completed" && !heardCompleteEvent) {
          playCompletionSound();
          toast.success("Workflow complete — results are ready", { duration: 5000 });
        }
      }
    } catch (e) {
      const msg = e?.message || e?.response?.data?.error || "Run failed";
      if (/cancelled|exhausted|Payment required|overage/i.test(msg)) {
        toast.error(msg, { duration: 8000 });
      } else {
        toast.error(msg);
      }
      if (activeRunId) {
        try {
          const { data: finalRun } = await api.get(WORKFLOW_API.runOne(activeRunId));
          if (finalRun?.success) {
            setCurrentRun(finalRun.data);
            syncNodeStatusesFromRun(finalRun.data, setNodeStatuses);
          }
        } catch {
          /* ignore */
        }
      }
    } finally {
      setIsRunning(false);
    }
  }, [workflowId, setNodeStatuses, setRunId]);

  return { isRunning, currentRun, liveLogs, runWorkflow, setCurrentRun };
}
