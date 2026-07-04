import { studioFetch } from "./studioFetch.js";

export function friendlyWorkflowError(err) {
  const msg = err?.response?.data?.error || err?.message || String(err);
  if (msg.includes("quota exceeded") || msg.includes("402")) {
    return "Payment required. Approve the transaction in your MetaMask.";
  }
  return msg.slice(0, 220) || "Workflow failed. Please retry.";
}

export async function runCreativeWorkflow(payload) {
  const res = await studioFetch("/api/studio/workflow/creative", {
    method: "POST",
    body: payload,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || res.statusText);
  }
  const data = await res.json();
  return data.result;
}
