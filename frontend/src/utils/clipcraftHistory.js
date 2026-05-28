const KEY = "sentinel_clipcraft_recent";

export function loadRecentClipJobs() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveRecentClipJob(entry) {
  const list = loadRecentClipJobs().filter((j) => j.jobId !== entry.jobId);
  list.unshift({ ...entry, savedAt: new Date().toISOString() });
  localStorage.setItem(KEY, JSON.stringify(list.slice(0, 20)));
}
