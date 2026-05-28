/** In-memory SSE subscribers per workflow run */
const subscribers = new Map();

export function subscribeRun(runId, res) {
  const id = String(runId);
  if (!subscribers.has(id)) subscribers.set(id, new Set());
  subscribers.get(id).add(res);
  res.on("close", () => {
    subscribers.get(id)?.delete(res);
  });
}

export function emitRunEvent(runId, payload) {
  const id = String(runId);
  const subs = subscribers.get(id);
  if (!subs) return;
  const line = `data: ${JSON.stringify(payload)}\n\n`;
  for (const res of subs) {
    try {
      res.write(line);
    } catch {
      subs.delete(res);
    }
  }
}

export function closeRunStream(runId) {
  const id = String(runId);
  const subs = subscribers.get(id);
  if (!subs) return;
  for (const res of subs) {
    try {
      res.end();
    } catch {
      /* ignore */
    }
  }
  subscribers.delete(id);
}
