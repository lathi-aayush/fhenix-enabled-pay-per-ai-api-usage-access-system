// @filename: backend/src/studio/clipcraft/production/gracefulShutdown.js

/**
 * Register SIGINT/SIGTERM handlers: stop accepting work, drain queue, close HTTP server.
 * @param {import('http').Server} server
 * @param {import('./ClipCraftRuntime.js').ClipCraftRuntime} [runtime]
 * @param {{ timeoutMs?: number }} [opts]
 */
export function registerClipCraftGracefulShutdown(server, runtime, opts = {}) {
  const timeoutMs = opts.timeoutMs ?? 30_000;
  let shuttingDown = false;

  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[clipcraft] ${signal} — draining (${timeoutMs}ms max)...`);

    const forceTimer = setTimeout(() => {
      console.error("[clipcraft] drain timeout — forcing exit");
      process.exit(1);
    }, timeoutMs);

    try {
      if (runtime) await runtime.drain();
      await new Promise((resolve) => server.close(resolve));
      clearTimeout(forceTimer);
      console.log("[clipcraft] shutdown complete");
      process.exit(0);
    } catch (e) {
      console.error("[clipcraft] shutdown error:", e.message);
      clearTimeout(forceTimer);
      process.exit(1);
    }
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}
