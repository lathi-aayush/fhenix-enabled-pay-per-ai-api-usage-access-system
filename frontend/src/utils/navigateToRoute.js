/**
 * Navigate to an in-app path, optionally with a hash fragment.
 * @param {import('react-router-dom').NavigateFunction} navigate
 * @param {string} target - e.g. "/docs/faq#burner-wallets"
 */
export function navigateToRoute(navigate, target) {
  const raw = String(target || "").trim();
  if (!raw) return;
  const hashIdx = raw.indexOf("#");
  if (hashIdx === -1) {
    navigate(raw);
    return;
  }
  const pathname = raw.slice(0, hashIdx) || "/";
  const hash = raw.slice(hashIdx + 1);
  navigate({ pathname, hash: hash ? `#${hash}` : undefined });
}
