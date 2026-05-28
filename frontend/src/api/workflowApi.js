/** Workflow Studio API paths (mounted under /api/studio) */
export const WORKFLOW_API = {
  list: "/api/studio/workflows",
  create: "/api/studio/workflows",
  one: (id) => `/api/studio/workflows/${id}`,
  duplicate: (id) => `/api/studio/workflows/${id}/duplicate`,
  estimate: (id) => `/api/studio/workflows/${id}/estimate`,
  run: (id) => `/api/studio/workflows/${id}/run`,
  runs: "/api/studio/workflow-runs",
  runOne: (runId) => `/api/studio/workflow-runs/${runId}`,
  runStream: (runId) => `/api/studio/workflow-runs/${runId}/stream`,
  templates: "/api/studio/workflow-templates",
  templateDuplicate: (id) => `/api/studio/workflow-templates/${id}/duplicate`,
};
