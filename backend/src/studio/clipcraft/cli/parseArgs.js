// @filename: backend/src/studio/clipcraft/cli/parseArgs.js

export function parseCliArgs(argv = process.argv.slice(2)) {
  const out = {
    url: null,
    urls: [],
    tier: "standard",
    batch: 1,
    userId: "cli-user",
    timeoutMs: 120_000,
    pollMs: 150,
    help: false,
    json: true,
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") out.help = true;
    else if (a === "--url" && argv[i + 1]) {
      out.urls.push(argv[++i]);
      out.url = out.urls[out.urls.length - 1];
    } else if (a === "--tier" && argv[i + 1]) out.tier = argv[++i];
    else if ((a === "--batch" || a === "--packs") && argv[i + 1]) {
      out.batch = Math.max(1, parseInt(argv[++i], 10) || 1);
    } else if (a === "--user" && argv[i + 1]) out.userId = argv[++i];
    else if (a === "--timeout" && argv[i + 1]) out.timeoutMs = Number(argv[++i]) || out.timeoutMs;
    else if (a === "--poll" && argv[i + 1]) out.pollMs = Number(argv[++i]) || out.pollMs;
    else if (a === "--no-json") out.json = false;
    else if (!a.startsWith("-") && !out.url) {
      out.url = a;
      out.urls.push(a);
    }
  }

  if (out.urls.length === 0 && out.url) out.urls = [out.url];
  return out;
}

export function printCliHelp() {
  return `ClipCraft CLI — mock E2E runner

Usage:
  node src/studio/clipcraft/cli/runClipCraft.js --url <video-url> [options]

Options:
  --url <url>       YouTube or Twitch URL (repeat for multiple jobs)
  --tier <t>        standard | viral (default: standard)
  --batch <n>       Clip pack count per job (default: 1, bulk at 10)
  --user <id>       User id for credits ledger (default: cli-user)
  --timeout <ms>    Poll timeout per job (default: 120000)
  --poll <ms>       Poll interval (default: 150)
  --no-json         Human-readable summary instead of JSON
  -h, --help        Show help
`;
}
