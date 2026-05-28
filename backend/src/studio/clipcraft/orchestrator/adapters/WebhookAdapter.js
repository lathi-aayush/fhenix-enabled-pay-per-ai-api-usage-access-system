// @filename: backend/src/studio/clipcraft/orchestrator/adapters/WebhookAdapter.js

/**
 * Webhook adapter — registers HTTP-style callbacks on orchestrator events.
 * @param {import('../JobOrchestrator.js').JobOrchestrator} orchestrator
 * @param {{ secret?: string }} [opts]
 */
export function createWebhookAdapter(orchestrator, opts = {}) {
  const deliveries = [];

  const unsubscribe = orchestrator.onWebhook((payload) => {
    const entry = {
      id: `wh-${Date.now()}`,
      event: payload.event,
      jobId: payload.job?.id,
      status: payload.job?.status,
      deliveredAt: new Date().toISOString(),
      secret: opts.secret ? "[redacted]" : undefined,
    };
    deliveries.push(entry);
    if (typeof opts.onDeliver === "function") opts.onDeliver(payload, entry);
  });

  return {
    deliveries,
    unsubscribe,
    getDeliveries(jobId) {
      return deliveries.filter((d) => !jobId || d.jobId === jobId);
    },
  };
}
