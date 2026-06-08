/** Pera Wallet tutorial — same URL as HowItWorks Step 2 */
export const PERA_WALLET_VIDEO_URL =
  "https://youtu.be/m720vHR8g1U?si=-n0sLN5b0sqMuLBk&t=57";

export const BLOCKED_REPLY =
  "I can't help with account credentials, authorization details, or confidential information. For security questions, use the in-app dashboard or official docs after signing in.";

export const FALLBACK_REPLY =
  "I can only answer predefined questions about Sentinal. Try one of the suggestions below, or visit our FAQ.";

export const SENSITIVE_DENYLIST = [
  "api key",
  "apikey",
  "jwt",
  "bearer",
  "secret",
  "password",
  "mnemonic",
  "seed phrase",
  "private key",
  "secret key",
  ".env",
  "env variable",
  "backend url",
  "internal",
  "admin",
  "bypass",
  "logged in",
  "my balance",
  "algo balance",
  "my algo",
  "my wallet",
  "my earnings",
  "my transactions",
  "my address",
  "show key",
  "reveal",
  "gemini key",
  "groq key",
  "openai key",
  "credentials",
  "session token",
  "refresh token",
  "authorization header",
  "auth token",
  "role permission",
];

/** Tier 1 chip ids — order preserved for UI */
export const TOP_SUGGESTION_IDS = [
  "what-is-sentinal",
  "features",
  "connect-pera",
  "pay-per-call",
  "ai-studio",
  "browse-apis",
];

export const ASSISTANT_FAQ = [
  {
    id: "what-is-sentinal",
    question: "What is Sentinal?",
    aliases: ["what is sentinal", "what is sentinel", "about sentinal", "tell me about sentinal"],
    answer:
      "Sentinal is a decentralized pay-per-use AI platform built on Algorand. Browse AI APIs in the Marketplace or create content with AI Studio — every call is billed in micro-ALGO with on-chain transparency.",
    action: { type: "scroll", target: "how-it-works", label: "Learn how it works" },
  },
  {
    id: "features",
    question: "What are Sentinal's features?",
    aliases: ["features", "what can sentinal do", "what does sentinal offer", "sentinal features"],
    answer:
      "Sentinal offers an API Marketplace for developers (pay-per-call AI APIs, x402 agent payments, on-chain billing) and AI Studio for creators (blog agent, prompt generator, workflows, ClipCraft, viral thumbnails).",
    action: { type: "scroll", target: "products", label: "Compare products" },
  },
  {
    id: "connect-pera",
    question: "How do I connect Pera Wallet?",
    aliases: ["connect pera", "pera wallet", "link wallet", "connect wallet", "how to connect wallet"],
    answer:
      "Click Connect Wallet in the top-right nav bar, select Pera Wallet, and approve the connection. Your ALGO balance will appear in the wallet bar once linked.",
    action: { type: "external", target: PERA_WALLET_VIDEO_URL, label: "Watch Pera Wallet tutorial" },
  },
  {
    id: "pay-per-call",
    question: "How does pay-per-call work?",
    aliases: ["pay per call", "pay-per-call", "micro payment", "micro algo", "billing model", "how does billing work"],
    answer:
      "Each API call is metered by our backend. Micro-ALGO is deducted from your wallet and settled on Algorand TestNet — no subscriptions, no credit cards, no middleman.",
    action: { type: "route", target: "/docs/how-it-works", label: "See payment flow" },
  },
  {
    id: "ai-studio",
    question: "What is AI Studio?",
    aliases: ["ai studio", "what is studio", "studio features", "content creator tools"],
    answer:
      "AI Studio is Sentinal's creator workspace — draft blogs, generate prompts, run workflows, edit clips, and schedule publishing across platforms.",
    action: { type: "route", target: "/studio", label: "Open AI Studio" },
  },
  {
    id: "browse-apis",
    question: "How do I browse APIs?",
    aliases: ["browse apis", "browse marketplace", "find apis", "marketplace", "api marketplace"],
    answer:
      "Visit the API Marketplace to discover image generation, NLP, speech, and other AI services published by verified creators.",
    action: { type: "route", target: "/marketplace/browse", label: "Browse Marketplace" },
  },
  {
    id: "x402",
    question: "What is the x402 protocol?",
    aliases: ["what is x402", "http 402", "machine payments", "x402 payments", "x402 protocol"],
    answer:
      "x402 extends HTTP 402 Payment Required so autonomous agents can negotiate prices and pay for API access programmatically on Algorand.",
    action: { type: "route", target: "/docs/x402", label: "Read x402 docs" },
  },
  {
    id: "integrate-api",
    question: "How do I use an API?",
    aliases: ["how to call api", "integrate api", "use api", "call an api", "developer integration"],
    answer:
      "Pick a service in the Marketplace and send requests to its endpoint. For keyless agent payments, use the x402 API docs or Developer SDK.",
    action: { type: "route", target: "/docs/x402-api", label: "View API docs" },
  },
  {
    id: "sdk",
    question: "Where is the Developer SDK?",
    aliases: ["sdk", "javascript client", "code example", "developer sdk", "sentinel client"],
    answer:
      "The JS/TS Sentinel client handles HTTP 402 challenges and on-chain settlement so you can integrate pay-per-call APIs quickly.",
    action: { type: "route", target: "/sdk-demo", label: "Try the SDK demo" },
  },
  {
    id: "pricing",
    question: "How much does it cost?",
    aliases: ["how much", "pricing", "algo cost", "fees", "cost per call", "price"],
    answer:
      "You pay per API call in micro-ALGO. Standard Algorand network fees apply (~0.001 ALGO per on-chain transaction).",
    action: { type: "route", target: "/docs/pricing", label: "View pricing" },
  },
  {
    id: "burner-wallet",
    question: "What is a burner wallet?",
    aliases: ["burner", "burner wallet", "micro payments wallet", "top up burner"],
    answer:
      "A browser-local burner wallet helps fund small payments without repeated Pera pop-ups. See the FAQ for a high-level overview.",
    action: { type: "route", target: "/docs/faq#burner-wallets", label: "Read burner wallet FAQ" },
  },
  {
    id: "transactions",
    question: "How do I view transactions?",
    aliases: ["billing", "transaction history", "on-chain txns", "payment history"],
    answer:
      "Payments are recorded on-chain. Signed-in users can review their full transaction history in Billing.",
    action: { type: "route", target: "/billing/transactions", label: "View transactions" },
  },
  {
    id: "dashboard",
    question: "Where is my dashboard?",
    aliases: ["my dashboard", "usage", "account", "user dashboard"],
    answer:
      "Signed-in users can manage usage and account settings from the dashboard.",
    action: { type: "route", target: "/dashboard/home", label: "Go to dashboard" },
  },
  {
    id: "creator",
    question: "How do I become a creator?",
    aliases: ["publish api", "sell api", "creator dashboard", "earn", "become creator", "publish apis"],
    answer:
      "Connect Pera as a creator, publish your AI services on the Marketplace, and track on-chain earnings from your creator dashboard.",
    action: { type: "route", target: "/creator", label: "Creator dashboard" },
  },
  {
    id: "blogging",
    question: "How does the Blogging Agent work?",
    aliases: ["write blog", "blog agent", "publish article", "blogging agent"],
    answer:
      "The Blogging Agent drafts full articles with AI and can publish to Hashnode, Dev.to, Medium, and more.",
    action: { type: "route", target: "/studio/blogging-agent", label: "Open Blogging Agent" },
  },
  {
    id: "workflows",
    question: "What are workflows?",
    aliases: ["workflow builder", "agentic pipeline", "automation", "workflows", "workflow studio"],
    answer:
      "Workflow Studio lets you build multi-step AI pipelines — connect prompts, image gen, and logic nodes in a visual canvas.",
    action: { type: "route", target: "/studio/workflows", label: "Open Workflow Studio" },
  },
  {
    id: "studio-plan",
    question: "What are Studio plan limits?",
    aliases: ["studio pricing", "plan limits", "upgrade studio", "studio plan"],
    answer:
      "Compare Studio tiers and usage limits on the plan page to find the right fit for your content workflow.",
    action: { type: "route", target: "/studio/plan", label: "View Studio plans" },
  },
  {
    id: "gateway",
    question: "What is the Gateway Marketplace?",
    aliases: ["gateway apis", "hosted gateway", "gateway marketplace"],
    answer:
      "The Gateway Marketplace lists APIs routed through Sentinal's gateway for high-throughput agent access.",
    action: { type: "route", target: "/marketplace/gateway", label: "Browse Gateway APIs" },
  },
  {
    id: "faq",
    question: "Where can I find more help?",
    aliases: ["more questions", "help", "support", "faq", "frequently asked"],
    answer:
      "Browse the protocol FAQ for wallets, refunds, network fees, and other common topics.",
    action: { type: "route", target: "/docs/faq", label: "Open FAQ" },
  },
];

function normalize(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[?!.,;:'"]+/g, " ")
    .replace(/\s+/g, " ");
}

/** Detect pasted secrets — never echo or FAQ-match these */
export function looksLikeSecret(text) {
  const raw = text.trim();
  if (!raw) return false;

  if (/^bearer\s+\S+/i.test(raw)) return true;
  if (/^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/.test(raw)) return true;
  if (/^sk-[A-Za-z0-9]{10,}/.test(raw)) return true;
  if (/^[A-Fa-f0-9]{64,}$/.test(raw)) return true;

  const words = raw.split(/\s+/);
  if (words.length >= 12 && words.every((w) => /^[a-z]+$/i.test(w))) return true;

  return false;
}

export function isSensitiveQuery(text) {
  const raw = text.toLowerCase().trim();
  const n = normalize(text);
  if (!raw && !n) return false;
  return SENSITIVE_DENYLIST.some(
    (phrase) => raw.includes(phrase) || (n && n.includes(phrase))
  );
}

function scoreMatch(normalizedInput, entry) {
  const q = normalize(entry.question);
  if (normalizedInput === q) return 1000;

  let best = 0;
  for (const alias of entry.aliases) {
    const a = normalize(alias);
    if (normalizedInput === a) best = Math.max(best, 900);
    else if (normalizedInput.includes(a) || a.includes(normalizedInput)) {
      best = Math.max(best, 100 + a.length);
    }
  }
  return best;
}

/**
 * @returns {{ type: 'blocked' | 'faq' | 'fallback', content: string, action?: object, showSuggestions?: boolean }}
 */
export function matchAssistantQuery(text) {
  if (looksLikeSecret(text) || isSensitiveQuery(text)) {
    return { type: "blocked", content: BLOCKED_REPLY };
  }

  const normalizedInput = normalize(text);
  if (!normalizedInput) {
    return { type: "fallback", content: FALLBACK_REPLY, showSuggestions: true };
  }

  let bestEntry = null;
  let bestScore = 0;

  for (const entry of ASSISTANT_FAQ) {
    const score = scoreMatch(normalizedInput, entry);
    if (score > bestScore) {
      bestScore = score;
      bestEntry = entry;
    }
  }

  if (bestEntry && bestScore >= 100) {
    return {
      type: "faq",
      content: bestEntry.answer,
      action: bestEntry.action,
    };
  }

  return { type: "fallback", content: FALLBACK_REPLY, showSuggestions: true };
}

export function getTopSuggestions() {
  return TOP_SUGGESTION_IDS.map((id) => ASSISTANT_FAQ.find((e) => e.id === id)).filter(Boolean);
}

export function getFaqByQuestion(question) {
  return ASSISTANT_FAQ.find((e) => e.question === question) ?? null;
}
