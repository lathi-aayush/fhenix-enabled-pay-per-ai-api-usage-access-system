import axios from "axios";

// This URL points to the main Sentinal backend.
// MUST be set via SENTINAL_API_URL env var in production (Render dashboard).
const SENTINAL_API_URL = process.env.SENTINAL_API_URL;

if (!SENTINAL_API_URL) {
  console.error(
    "⛔ CRITICAL: SENTINAL_API_URL is not set. " +
    "All calls to the main backend will fail. " +
    "Set this to https://sentinal-j4ox.onrender.com in your Render environment."
  );
}

export const sentinalApi = axios.create({
  baseURL: SENTINAL_API_URL || "https://sentinal-j4ox.onrender.com",
  headers: { "Content-Type": "application/json" },
  timeout: 15000,
});
