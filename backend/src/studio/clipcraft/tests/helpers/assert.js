// @filename: backend/src/studio/clipcraft/tests/helpers/assert.js

export function ok(cond, msg) {
  if (!cond) throw new Error(msg || "Assertion failed");
}

export async function test(name, fn) {
  try {
    await fn();
    return { name, ok: true };
  } catch (e) {
    return { name, ok: false, error: e.message };
  }
}
