import axios from "axios";

/** Node API on Render (not the static site at sentinalai.dev). */
export const PRODUCTION_API = "https://sentinal-z3ue.onrender.com";

function normalizeBase(url) {
  return String(url).trim().replace(/\/$/, "");
}

/** Hostnames that serve the SPA only — not the Express API. */
function isSpaOnlyHost(url) {
  try {
    const { hostname } = new URL(url);
    const bare = hostname.replace(/^www\./, "");
    return (
      hostname === "sentinalai.dev" ||
      bare === "sentinalai.dev" ||
      hostname === "sentinalai.com" ||
      bare === "sentinalai.com"
    );
  } catch {
    return false;
  }
}

function resolveProductionApiUrl(raw) {
  if (!raw) return PRODUCTION_API;
  const normalized = normalizeBase(raw);
  if (isSpaOnlyHost(normalized)) {
    console.warn(
      `[Sentinal] VITE_API_URL points at the website (${normalized}), not the API. ` +
        `Using ${PRODUCTION_API}. Set VITE_API_URL to your Render backend URL.`
    );
    return PRODUCTION_API;
  }
  return normalized;
}

/**
 * API base URL.
 * - Dev: "" → browser calls /api on localhost:5173; Vite proxies to backend (no CORS).
 * - Prod: VITE_API_URL or PRODUCTION_API (Render backend).
 */
export function getApiBase() {
  if (import.meta.env.DEV) {
    return "";
  }
  return resolveProductionApiUrl(import.meta.env.VITE_API_URL?.trim());
}

const base = getApiBase();

export const api = axios.create({
  baseURL: base || undefined,
  headers: { "Content-Type": "application/json" },
});

export function setAuthToken(token) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
}

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const hadAuth = Boolean(
      error.config?.headers?.Authorization || api.defaults.headers.common.Authorization
    );
    if (error.response?.status === 401 && hadAuth) {
      window.dispatchEvent(new CustomEvent("auth:session-expired"));
    }
    return Promise.reject(error);
  }
);
