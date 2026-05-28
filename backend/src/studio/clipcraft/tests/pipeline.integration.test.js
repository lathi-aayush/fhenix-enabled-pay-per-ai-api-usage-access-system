// @filename: backend/src/studio/clipcraft/tests/pipeline.integration.test.js

import { runClipCraftE2E } from "../integration/runE2E.js";
import { JobStatusFlow } from "../contracts/JobStatusFlow.js";
import { ok, test } from "./helpers/assert.js";

export async function runPipelineIntegrationTests() {
  const results = [];

  results.push(
    await test("e2e single url completes ready", async () => {
      const r = await runClipCraftE2E({
        urls: ["https://youtu.be/dQw4w9WgXcQ"],
        tier: "standard",
        packCount: 1,
        userId: "test-pipeline",
        initialCredits: 50,
      });
      ok(r.ok);
      ok(r.jobs[0].status === JobStatusFlow.READY);
      ok(r.jobs[0].segmentCount >= 1);
      ok(r.transactionLog.length >= 1);
    })
  );

  return results;
}
