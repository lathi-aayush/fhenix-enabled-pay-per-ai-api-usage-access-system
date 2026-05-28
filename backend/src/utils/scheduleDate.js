/**
 * Parse datetime-local (YYYY-MM-DDTHH:mm) as server-local wall time.
 * Avoids UTC offset bugs from `new Date("2026-05-28T18:00")`.
 */
export function parseScheduledFor(value) {
  if (value == null || !String(value).trim()) return null;
  const s = String(value).trim();

  const localMatch = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(s);
  if (localMatch) {
    const [, y, mo, d, hh, mm, ss] = localMatch;
    const runAt = new Date(
      Number(y),
      Number(mo) - 1,
      Number(d),
      Number(hh),
      Number(mm),
      ss ? Number(ss) : 0,
      0
    );
    if (Number.isNaN(runAt.getTime())) {
      throw new Error("Invalid schedule date");
    }
    return runAt;
  }

  const runAt = new Date(s);
  if (Number.isNaN(runAt.getTime())) {
    throw new Error("Invalid schedule date");
  }
  return runAt;
}

export function isScheduleDue(runAt, graceMs = 5000) {
  return runAt.getTime() <= Date.now() + graceMs;
}
