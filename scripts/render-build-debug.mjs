import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_PATH = path.resolve(__dirname, "..", "debug-655066.log");
const ENDPOINT = "http://127.0.0.1:7788/ingest/4b0d5b8c-41a2-4139-98e0-1384e9a720fa";

function agentLog(hypothesisId, location, message, data = {}) {
  const payload = {
    sessionId: "655066",
    runId: process.env.RENDER ? "render" : "local",
    hypothesisId,
    location,
    message,
    data,
    timestamp: Date.now(),
  };
  // #region agent log
  try {
    fs.appendFileSync(LOG_PATH, `${JSON.stringify(payload)}\n`);
  } catch {
    /* ignore local log write failures */
  }
  fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "655066" },
    body: JSON.stringify(payload),
  }).catch(() => {});
  // #endregion
}

const backendPkg = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, "..", "backend", "package.json"), "utf8")
);
const frontendChain = path.resolve(__dirname, "..", "frontend", "src", "config", "chain.js");
const studioChat = path.resolve(
  __dirname,
  "..",
  "frontend",
  "src",
  "pages",
  "studio",
  "StudioChat.jsx"
);

agentLog("H1", "render-build-debug.mjs:34", "backend build script present", {
  hasBuild: Boolean(backendPkg.scripts?.build),
  buildCommand: backendPkg.scripts?.build || null,
});
agentLog("H3", "render-build-debug.mjs:39", "render build context", {
  cwd: process.cwd(),
  render: Boolean(process.env.RENDER),
  nodeVersion: process.version,
});
agentLog("H4", "render-build-debug.mjs:45", "frontend build prerequisites", {
  chainConfigExists: fs.existsSync(frontendChain),
  studioChatExists: fs.existsSync(studioChat),
});
agentLog("H2", "render-build-debug.mjs:50", "deploy commit hint", {
  renderGitCommit: process.env.RENDER_GIT_COMMIT || null,
  renderServiceName: process.env.RENDER_SERVICE_NAME || null,
});

console.log("[render-build-debug] build prerequisites logged");
