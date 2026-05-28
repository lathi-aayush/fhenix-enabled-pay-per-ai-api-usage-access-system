export const PROMPT_CATEGORIES = [
  "General",
  "Marketing",
  "Development",
  "Content Creation",
  "Research",
  "Image Generation",
  "Video / YouTube",
  "AI Agents",
];

export const PROMPT_TYPES = [
  "Instruction",
  "Creative Writing",
  "Code Generation",
  "Analysis",
  "Role-play",
  "Chain-of-thought",
];

export const PROMPT_MODES = [
  { id: "beginner", label: "Beginner", hint: "Clear, concise, single-step" },
  { id: "advanced", label: "Advanced", hint: "Multi-step + constraints" },
  { id: "expert", label: "Expert", hint: "Role engineering + CoT" },
];

export const QUICK_TEMPLATES = [
  {
    id: "linkedin",
    label: "LinkedIn Post",
    category: "Marketing",
    type: "Creative Writing",
    goal: "Write a high-engagement LinkedIn post for a B2B SaaS founder announcing a product milestone.",
  },
  {
    id: "seo",
    label: "SEO Article",
    category: "Content Creation",
    type: "Instruction",
    goal: "Create an SEO-optimized long-form article outline with H2s, meta description, and keyword placement strategy.",
  },
  {
    id: "coding",
    label: "Coding Assistant",
    category: "Development",
    type: "Code Generation",
    goal: "Generate a production-ready React component with TypeScript, tests, and error handling.",
  },
  {
    id: "agent",
    label: "AI Agent",
    category: "AI Agents",
    type: "Role-play",
    goal: "Design an autonomous AI agent system prompt with tools, guardrails, and escalation rules.",
  },
  {
    id: "startup",
    label: "Startup Research",
    category: "Research",
    type: "Analysis",
    goal: "Research a startup niche: TAM, competitors, positioning, and GTM recommendations.",
  },
  {
    id: "image",
    label: "Image Gen",
    category: "Image Generation",
    type: "Creative Writing",
    goal: "Write a detailed image generation prompt for a photorealistic 16:9 marketing hero visual.",
  },
  {
    id: "youtube",
    label: "YouTube Script",
    category: "Video / YouTube",
    type: "Instruction",
    goal: "Write a 8-minute YouTube script with hook, chapters, CTA, and retention beats.",
  },
  {
    id: "funnel",
    label: "Marketing Funnel",
    category: "Marketing",
    type: "Chain-of-thought",
    goal: "Map a full marketing funnel: awareness → consideration → conversion with email and ad copy angles.",
  },
];
