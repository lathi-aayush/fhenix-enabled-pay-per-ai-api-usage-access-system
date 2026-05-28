// @filename: backend/src/studio/clipcraft/tests/urlIngestion.test.js

import { createMockUrlIngestion } from "../mocks/MockUrlIngestion.js";
import { ok, test } from "./helpers/assert.js";

export async function runUrlIngestionTests() {
  const urlSvc = createMockUrlIngestion();
  const results = [];

  results.push(
    await test("parses youtube video id", async () => {
      const m = await urlSvc.normalizeUrl("https://www.youtube.com/watch?v=abc123XYZ");
      ok(m.platform === "youtube");
      ok(m.videoId === "abc123XYZ");
    })
  );

  results.push(
    await test("rejects invalid url", async () => {
      let err = false;
      try {
        await urlSvc.normalizeUrl("not-a-url");
      } catch {
        err = true;
      }
      ok(err);
    })
  );

  return results;
}
