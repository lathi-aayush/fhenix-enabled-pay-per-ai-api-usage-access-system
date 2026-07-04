/**
 * One-shot fix for UTF-8 mojibake (â€", ·, â†', etc.) across source files.
 * Run: node scripts/fix-mojibake.js
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".mongo-data",
  "cofhesdk",
  "artifacts",
  "cache",
  "typechain-types",
]);

const EXT = new Set([".js", ".jsx", ".ts", ".tsx", ".md", ".html", ".css", ".sol"]);

// Order matters: longer / more specific sequences first.
const REPLACEMENTS = [
  ["\u00c2\u00b7", "\u00b7"], // · → ·
  ["\u00e2\u20ac\u201d", "\u2014"], // â€" → —
  ["\u00e2\u20ac\u00a6", "\u2026"], // … → …
  ["\u00e2\u20ac\u00a2", "\u2022"], // • → •
  ["\u00e2\u20ac\u201c", "\u2013"], // â€" → –
  ["\u00e2\u20ac\u0153", "\u201c"], // “ → "
  ["\u00e2\u20ac\u009d", "\u201d"], // â€ → "
  ["\u00e2\u2020\u2019", "\u2192"], // â†' → →
  ["\u00e2\u2020\u0090", "\u2190"], // â† → ←
  ["\u00e2\u201d\u20ac", "\u2500"], // â"€ → ─
  ["\u00e2\u2022\u0090", "\u2550"], // â• → ═
  ["\u00e2\u0153\u201c", "\u2713"], // âœ" → ✓
  ["\u00e2\u2013\u00b6", "\u25b6"], // ▶ → ▶
  ["\u00e2\u0153\u2026", "\u2705"], // ✅ → ✅
  ["\u00e2\u0153\u2014", "\u2717"], // ✗ → ✗
  ["\u00e2\u0153\u2022", "\u2715"], // ✕ → ✕
  ["\u00e2\u0161\u00a0", "\u26a0"], // âš  → ⚠
  ["\u00e2\u02dc\u2026", "\u2605"], // ★ → ★
  ["\u00e2\u201a\u00b9", "\u20b9"], // ₹ → ₹
  ["\u00e2\u2030\u02c6", "\u2248"], // ≈ → ≈
  ["\u00e2\u009d\u0152", "\u274c"], // âŒ → ❌
  ["\u00c3\u2014", "\u00d7"], // × → ×
  ["\u00ce\u00a3", "\u03a3"], // Σ → Σ
  ["\u00c2\u00a9", "\u00a9"], // © → ©
  ["\u00c2\u00b1", "\u00b1"], // ± → ±
];

function walk(dir, files = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(ent.name)) continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, files);
    else if (EXT.has(path.extname(ent.name))) files.push(full);
  }
  return files;
}

function fixText(text) {
  let out = text;
  for (const [from, to] of REPLACEMENTS) out = out.split(from).join(to);
  return out;
}

const files = walk(ROOT);
let changed = 0;

for (const file of files) {
  const before = fs.readFileSync(file, "utf8");
  const after = fixText(before);
  if (after !== before) {
    fs.writeFileSync(file, after, "utf8");
    changed++;
    console.log(path.relative(ROOT, file));
  }
}

console.log(`\nFixed ${changed} file(s).`);
