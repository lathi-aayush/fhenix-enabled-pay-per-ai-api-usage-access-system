/** Base URL for integration examples (curl / external apps). */
export function getPublicApiBase() {
  const raw = import.meta.env.VITE_API_URL;
  if (raw && String(raw).trim()) {
    return String(raw).replace(/\/$/, "");
  }
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return "";
}
