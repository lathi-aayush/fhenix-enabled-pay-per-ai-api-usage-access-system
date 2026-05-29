import { api } from "./client.js";

export function friendlyWorkflowError(err) {
  const msg = err?.response?.data?.error || err?.message || String(err);
  if (msg.includes("quota exceeded")) {
    return "Monthly Studio AI limit reached. Upgrade your plan to continue.";
  }
  return msg.slice(0, 220) || "Workflow failed. Please retry.";
}

export async function runCreativeWorkflow(payload) {
  const { data } = await api.post("/api/studio/workflow/creative", payload);
  return data.result;
}
