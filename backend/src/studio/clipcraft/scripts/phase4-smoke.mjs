// @filename: backend/src/studio/clipcraft/scripts/phase4-smoke.mjs
import { runClipCraftE2E } from "../integration/runE2E.js";

const result = await runClipCraftE2E({
  urls: ["https://www.youtube.com/watch?v=dQw4w9WgXcQ"],
  tier: "viral",
  packCount: 10,
  userId: "phase4-user",
  initialCredits: 100,
});

console.log(
  JSON.stringify(
    {
      ok: result.ok,
      jobs: result.jobs.length,
      status: result.jobs.map((j) => j.status),
      creditsSpent: result.credits.spent,
      txLogEntries: result.transactionLog.length,
    },
    null,
    2
  )
);

process.exit(result.ok ? 0 : 1);
