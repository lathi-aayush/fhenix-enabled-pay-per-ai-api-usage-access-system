#!/usr/bin/env node
// @filename: backend/src/studio/clipcraft/tests/runAll.js

import { runStateMachineTests } from "./stateMachine.test.js";
import { runCreditsTests } from "./credits.test.js";
import { runUrlIngestionTests } from "./urlIngestion.test.js";
import { runPipelineIntegrationTests } from "./pipeline.integration.test.js";

const suites = [
  { name: "stateMachine", run: runStateMachineTests },
  { name: "credits", run: runCreditsTests },
  { name: "urlIngestion", run: runUrlIngestionTests },
  { name: "pipeline.integration", run: runPipelineIntegrationTests },
];

const report = { ok: true, suites: [], total: 0, passed: 0, failed: 0 };

for (const suite of suites) {
  const tests = await suite.run();
  const passed = tests.filter((t) => t.ok).length;
  const failed = tests.filter((t) => !t.ok).length;
  report.suites.push({ name: suite.name, tests, passed, failed });
  report.total += tests.length;
  report.passed += passed;
  report.failed += failed;
  if (failed > 0) report.ok = false;
}

console.log(JSON.stringify(report, null, 2));
process.exit(report.ok ? 0 : 1);
