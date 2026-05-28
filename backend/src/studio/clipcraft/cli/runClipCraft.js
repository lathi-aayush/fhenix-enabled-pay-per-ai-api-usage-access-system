#!/usr/bin/env node
// @filename: backend/src/studio/clipcraft/cli/runClipCraft.js

import { parseCliArgs, printCliHelp } from "./parseArgs.js";
import { runClipCraftE2E } from "../integration/runE2E.js";

async function main() {
  const args = parseCliArgs();
  if (args.help || args.urls.length === 0) {
    console.log(printCliHelp());
    process.exit(args.help ? 0 : 1);
  }

  if (!["standard", "viral"].includes(args.tier)) {
    console.error('Invalid --tier. Use "standard" or "viral".');
    process.exit(1);
  }

  const result = await runClipCraftE2E({
    urls: args.urls,
    tier: args.tier,
    packCount: args.batch,
    userId: args.userId,
    timeoutMs: args.timeoutMs,
    pollMs: args.pollMs,
  });

  if (args.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`ClipCraft E2E: ${result.ok ? "OK" : "FAILED"}`);
    console.log(`Jobs: ${result.jobs.length} | Credits spent: ${result.credits.spent}`);
    for (const j of result.jobs) {
      console.log(`  - ${j.jobId} ${j.status} (${j.segmentCount} segments)`);
    }
    console.log(`Transactions: ${result.transactionLog.length}`);
  }

  process.exit(result.ok ? 0 : 1);
}

main().catch((e) => {
  console.error(JSON.stringify({ ok: false, error: e.message }, null, 2));
  process.exit(1);
});
