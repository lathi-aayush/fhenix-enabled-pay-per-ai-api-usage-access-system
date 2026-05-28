import { useCallback, useState } from "react";
import toast from "react-hot-toast";
import { api, getApiBase } from "../api/client.js";
import { WORKFLOW_API } from "../api/workflowApi.js";
import { getBurnerBalance, sendBurnerPayment, getDefaultAlgodServer } from "../wallet/burner.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useNodeExecution } from "../context/NodeExecutionContext.jsx";
import { extractBlogResult } from "../utils/workflowBlog.js";

const STORAGE_KEY = "sentinal_token";

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
  const { burnerReady } = useAuth();
  const algodServer = getDefaultAlgodServer();

  const runWorkflow = useCallback(async () => {
    if (!workflowId) return;
    if (!burnerReady) {
      toast.error("Burner wallet is still loading. Try again in a moment.");
      return;
    }
    setIsRunning(true);
    setLiveLogs([]);
    setNodeStatuses({});

    try {
      const { data: estRes } = await api.post(WORKFLOW_API.estimate(workflowId));
      const estimatedCredits = estRes?.data?.estimatedCredits ?? 0.001;
      if (!estRes?.data?.valid) {
        toast.error(estRes?.data?.errors?.join("; ") || "Invalid workflow");
        return;
      }

      const ok = window.confirm(
        `This run will cost approximately ${estimatedCredits.toFixed(4)} ALGO from your burner wallet. Proceed?`
      );
      if (!ok) return;

      const microBal = await getBurnerBalance(algodServer);
      const microNeed = Math.max(1000, Math.ceil(estimatedCredits * 1_000_000));
      if (microBal < microNeed) {
        toast.error("Insufficient burner balance — fund it from the wallet bar above.");
        return;
      }

      const recipient = estRes?.data?.recipient;
      if (!recipient) {
        toast.error("Platform treasury wallet not configured on server");
        return;
      }

      let paymentProof;
      try {
        const payRes = await sendBurnerPayment({
          to: recipient,
          amountMicroAlgos: microNeed,
          noteStr: `workflow:${workflowId}`,
          algodServer,
        });
        paymentProof = payRes.txId;
        window.dispatchEvent(new CustomEvent("walletBalanceUpdate"));
      } catch (payErr) {
        toast.error(payErr?.message || "Burner payment failed");
        return;
      }

      const { data: runRes } = await api.post(WORKFLOW_API.run(workflowId), {
        paymentProof,
        idempotencyKey: `run_${Date.now()}`,
      });

      const runId = runRes?.data?.runId;
      if (!runId) throw new Error("No run id returned");
      setRunId(runId);

      await streamRunEvents(runId, (evt) => {
        if (evt.type === "log") setLiveLogs((prev) => [...prev, evt.line]);
        if (evt.nodeId && evt.status) {
          setNodeStatuses((prev) => ({ ...prev, [evt.nodeId]: evt.status }));
        }
        if (evt.type === "complete") {
          toast.success(`Run ${evt.status}`);
          if (evt.structuredResult) {
            setCurrentRun((prev) =>
              prev ? { ...prev, structuredResult: evt.structuredResult, status: evt.status } : prev
            );
          }
        }
      });

      const { data: finalRun } = await api.get(WORKFLOW_API.runOne(runId));
      if (finalRun?.success) {
        setCurrentRun(finalRun.data);
        const statuses = {};
        for (const nr of finalRun.data.nodeResults || []) {
          statuses[nr.nodeId] = nr.status === "completed" ? "success" : nr.status;
        }
        setNodeStatuses(statuses);
        const blog = extractBlogResult(finalRun.data);
        if (blog?.blogPostId) {
          if (blog.status === "published") {
            toast.success(`Published: ${blog.title}`, { duration: 6000 });
          } else {
            toast.success(`Blog ready: ${blog.title}`, { duration: 5000 });
          }
        }
      }
    } catch (e) {
      toast.error(e?.response?.data?.error || e.message || "Run failed");
    } finally {
      setIsRunning(false);
    }
  }, [workflowId, setNodeStatuses, setRunId, burnerReady, algodServer]);

  return { isRunning, currentRun, liveLogs, runWorkflow, setCurrentRun };
}
