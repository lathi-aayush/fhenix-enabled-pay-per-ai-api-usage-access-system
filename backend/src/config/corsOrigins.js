/**
 * Build CORS allowlist from env (comma-separated) + known production hosts.
 * @param {Record<string, string | undefined>} [env]
 */
export function buildCorsOrigins(env = process.env) {
  const fromEnv = [
    env.FRONTEND_ORIGIN,
    env.FRONTEND_URL,
    env.CORS_ALLOWED_ORIGINS,
    env.RENDER_EXTERNAL_URL,
  ]
    .filter(Boolean)
    .flatMap((v) => String(v).split(","))
    .map((s) => s.trim())
    .filter(Boolean);

  const defaults = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
    "http://localhost:5176",
    "http://localhost:5177",
    "https://sentinalai.dev",
    "https://www.sentinalai.dev",
    "https://sentinal-j4ox.onrender.com",
    "https://sentinal-z3ue.onrender.com",
    "https://pay-per-usage-ai-api-access-system-using-zrgu.onrender.com",
  ];

  return [...new Set([...fromEnv, ...defaults])];
}

/**
 * @param {string | undefined} origin
 * @param {string[]} allowed
 */
export function isCorsOriginAllowed(origin, allowed) {
  if (!origin) return true;
  return allowed.includes(origin);
}
