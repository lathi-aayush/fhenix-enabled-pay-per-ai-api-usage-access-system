import { getApiBase } from "./client.js";
import { requestOverageConsent } from "../components/studio/OverageConsentModal.jsx";

function authHeaders(extra = {}) {
  const token = localStorage.getItem("sentinal_token");
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

/**
 * Fetch Studio endpoint with automatic x402 overage retry.
 * @param {string} url path e.g. /api/studio/agentic/run
 * @param {RequestInit & { body?: object | FormData }} options
 */
export async function studioFetch(url, options = {}) {
  const base = getApiBase();
  const isForm = options.body instanceof FormData;
  const headers = authHeaders(options.headers || {});

  if (!isForm && options.body && typeof options.body === "object") {
    headers["Content-Type"] = "application/json";
  }

  let response = await fetch(`${base}${url}`, {
    ...options,
    headers,
    body:
      isForm || options.body == null
        ? options.body
        : typeof options.body === "string"
          ? options.body
          : JSON.stringify(options.body),
  });

  if (response.status === 402) {
    let payload;
    try {
      payload = await response.json();
    } catch {
      throw new Error("Payment required but response was not JSON");
    }
    const overage = payload.studioOverage;
    if (!overage?.amountWei) {
      const hint = payload.hint || payload.error || "Payment required";
      const credits =
        payload.creditsRemaining != null
          ? ` (${payload.creditsRemaining} credits left, need ${payload.creditCost ?? "?"})`
          : "";
      throw new Error(`${hint}${credits}. Deploy the latest backend or upgrade at /studio/plan.`);
    }
    const xPayment = await requestOverageConsent(overage);
    if (!xPayment) {
      throw new Error("Overage payment cancelled");
    }
    response = await fetch(`${base}${url}`, {
      ...options,
      headers: { ...headers, "X-Payment": xPayment },
      body:
        isForm || options.body == null
          ? options.body
          : typeof options.body === "string"
            ? options.body
            : JSON.stringify(options.body),
    });
  }

  return response;
}
