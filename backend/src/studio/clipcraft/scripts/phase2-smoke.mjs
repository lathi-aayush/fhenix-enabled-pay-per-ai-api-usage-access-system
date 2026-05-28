// @filename: backend/src/studio/clipcraft/scripts/phase2-smoke.mjs
import { bootstrapClipCraftMocks } from "../registry/bootstrapMocks.js";
import { RegistryKeys } from "../registry/ServiceRegistry.js";
import { seedUserCredits } from "../services/CreditsBillingEngine.js";
import { shouldRefundOnFailure } from "../services/refundPolicy.js";
import { JobStatusFlow } from "../contracts/JobStatusFlow.js";

const reg = bootstrapClipCraftMocks(undefined, { defaultCredits: 50 });
const url = reg.resolve(RegistryKeys.URL_INGESTION);
const transcript = reg.resolve(RegistryKeys.TRANSCRIPT);
const analyzer = reg.resolve(RegistryKeys.SEGMENT_ANALYZER);
const copy = reg.resolve(RegistryKeys.COPY_GENERATOR);
const credits = reg.resolve(RegistryKeys.CREDITS);

const userId = "user-phase2";
seedUserCredits(userId, 50);

const meta = await url.normalizeUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
const tr = await transcript.fetchTranscript({ videoId: meta.videoId, platform: meta.platform, url: meta.canonicalUrl });
const analysis = await analyzer.analyzeSegments({ transcript: tr, maxSegments: 2 });
const copyOut = await copy.generateCopy({ segments: analysis.segments, tier: "viral" });

const cost = credits.calculateCost({ packCount: 1, tier: "viral" });
const d1 = await credits.deductAtomic({ userId, amount: cost, jobId: "job-1", idempotencyKey: "idem-1" });
const d2 = await credits.deductAtomic({ userId, amount: cost, jobId: "job-1", idempotencyKey: "idem-1" });
const bal = await credits.getBalance(userId);

const refundOk = shouldRefundOnFailure(JobStatusFlow.GENERATING_COPY, cost);
await credits.refund({ userId, amount: cost, jobId: "job-1", reason: "mock-fail-after-analyze" });
const balAfter = await credits.getBalance(userId);

console.log(
  JSON.stringify(
    {
      ok: d1.ok && d2.ok && d1.transactionId === d2.transactionId,
      videoId: meta.videoId,
      segments: analysis.segments.length,
      hooks: copyOut.segments[0]?.hooks?.length,
      cost,
      balanceAfterDeduct: bal.balance,
      refundEligible: refundOk,
      balanceAfterRefund: balAfter.balance,
      txCount: balAfter.transactions.length,
    },
    null,
    2
  )
);
