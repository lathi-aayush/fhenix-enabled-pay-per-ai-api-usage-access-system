// @filename: backend/src/studio/clipcraft/tests/credits.test.js

import { createCreditsBillingEngine, resetCreditsLedger, seedUserCredits } from "../services/CreditsBillingEngine.js";
import { calculateClipJobCredits } from "../contracts/pricing.js";
import { shouldRefundOnFailure } from "../services/refundPolicy.js";
import { JobStatusFlow } from "../contracts/JobStatusFlow.js";
import { loadClipCraftConfig } from "../config/loadConfig.js";
import { ok, test } from "./helpers/assert.js";

export async function runCreditsTests() {
  resetCreditsLedger();
  const config = loadClipCraftConfig({ force: true });
  const credits = createCreditsBillingEngine(config);
  const results = [];

  results.push(
    await test("bulk pricing at 10 packs", () => {
      ok(calculateClipJobCredits(10, "standard") === 12);
    })
  );

  results.push(
    await test("viral surcharge applied", () => {
      const v = calculateClipJobCredits(1, "viral");
      ok(v > calculateClipJobCredits(1, "standard"));
    })
  );

  results.push(
    await test("deduct is idempotent", async () => {
      seedUserCredits("u-cred", 10);
      const a = await credits.deductAtomic({
        userId: "u-cred",
        amount: 2,
        jobId: "j1",
        idempotencyKey: "idem-a",
      });
      const b = await credits.deductAtomic({
        userId: "u-cred",
        amount: 2,
        jobId: "j1",
        idempotencyKey: "idem-a",
      });
      ok(a.ok && b.ok && a.transactionId === b.transactionId);
      const bal = await credits.getBalance("u-cred");
      ok(bal.balance === 8);
    })
  );

  results.push(
    await test("refund after analyzing stage", () => {
      ok(shouldRefundOnFailure(JobStatusFlow.GENERATING_COPY, 5));
      ok(!shouldRefundOnFailure(JobStatusFlow.TRANSCRIBING, 5));
    })
  );

  return results;
}
