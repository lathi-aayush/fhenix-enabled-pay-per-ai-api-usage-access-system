// @filename: backend/src/studio/clipcraft/mocks/MockExportProvider.js

import { asExportProvider } from "../interfaces/IExportProvider.js";

/** @type {Map<string, { status: string, artifactUrl?: string }>} */
const renders = new Map();

export function createMockExportProvider() {
  return asExportProvider({
    async queueRender({ job, targets }) {
      const refs = targets.map((target) => {
        const renderId = `render-${job.id}-${target}-${Date.now()}`;
        renders.set(renderId, {
          status: "processing",
          artifactUrl: `https://cdn.clipcraft.mock/${job.id}/${target}.mp4`,
        });
        setTimeout(() => {
          const r = renders.get(renderId);
          if (r) renders.set(renderId, { ...r, status: "ready" });
        }, 50);
        return { renderId, jobId: job.id, target, status: "processing" };
      });
      return refs;
    },
    async getRenderStatus(renderId) {
      const r = renders.get(renderId);
      if (!r) return { status: "unknown", error: "Render not found" };
      return { status: r.status, artifactUrl: r.artifactUrl };
    },
  });
}

export function resetMockExportStore() {
  renders.clear();
}
