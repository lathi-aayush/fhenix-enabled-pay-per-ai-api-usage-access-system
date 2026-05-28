// @filename: backend/src/studio/clipcraft/tests/stateMachine.test.js

import { JobStatusFlow } from "../contracts/JobStatusFlow.js";
import {
  canTransition,
  applyTransition,
  InvalidJobTransitionError,
} from "../state/JobStateMachine.js";
import { createEmptyClipJob } from "../contracts/schemas.js";
import { ok, test } from "./helpers/assert.js";

export async function runStateMachineTests() {
  const results = [];

  results.push(
    await test("allows queued → transcribing", () => {
      ok(canTransition(JobStatusFlow.QUEUED, JobStatusFlow.TRANSCRIBING));
    })
  );

  results.push(
    await test("blocks analyzing → ready", () => {
      ok(!canTransition(JobStatusFlow.ANALYZING, JobStatusFlow.READY));
    })
  );

  results.push(
    await test("applyTransition updates progress", () => {
      const job = createEmptyClipJob({ id: "t1", url: "https://youtu.be/x" });
      applyTransition(job, JobStatusFlow.TRANSCRIBING);
      ok(job.progressPercent === 15);
    })
  );

  results.push(
    await test("invalid transition throws", () => {
      let threw = false;
      try {
        applyTransition(createEmptyClipJob({ id: "t2", url: "https://youtu.be/x" }), JobStatusFlow.READY);
      } catch (e) {
        threw = e instanceof InvalidJobTransitionError;
      }
      ok(threw);
    })
  );

  return results;
}
