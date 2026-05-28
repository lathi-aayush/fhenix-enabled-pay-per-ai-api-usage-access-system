import axios from "axios";

/** Local dev defaults to backend/.env PORT (5001). Set VITE_API_URL for production builds. */
export function getApiBase() {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  if (import.meta.env.DEV) return "http://localhost:5001";
  return "";
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
