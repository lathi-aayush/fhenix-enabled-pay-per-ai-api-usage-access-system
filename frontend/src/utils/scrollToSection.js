/**
 * Scroll to a landing-page section from any route (fixes hash links on sentinalai.dev SPA).
 * @param {import('react-router-dom').NavigateFunction} navigate
 * @param {string} sectionId - e.g. "studio" (no #)
 */
export function goToHomeSection(navigate, sectionId) {
  const id = sectionId.replace(/^#/, "");
  if (window.location.pathname === "/") {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.history.replaceState(null, "", `/#${id}`);
    return;
  }
  navigate(`/#${id}`);
}
