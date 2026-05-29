# Workflow Studio — implementation notes

## Deviations from blueprint v2.0

1. **Module system**: Backend uses ESM (`import`/`export`), not CommonJS `require`.
2. **React Flow package**: Uses `@xyflow/react` (current package); blueprint also lists legacy `reactflow`.
3. **x402 SDK**: `@coinbase/x402` not added; payment uses burner wallet → treasury ALGO transfer + `paymentProof` (txId) verification stub in `x402PaymentService.js`. Swap in Coinbase SDK when contract address is ready.
4. **Zustand**: Not used; state lives in `WorkflowContext` + `NodeExecutionContext` per blueprint contracts.
5. **SSE auth**: Stream uses `fetch` + `ReadableStream` with `Authorization` header (EventSource cannot send JWT).
6. **Studio integration**: Routes under `/studio/workflows/*` inside existing `StudioLayout` (not a separate app root).

## Env (backend)

```
GROQ_API_KEY=...
TREASURY_WALLET=...          # payment recipient for workflow runs
X402_CONTRACT_ADDRESS=...    # optional override
REDIS_URL=...                # existing studio queue
```

## API paths (after fix)

All workflow endpoints live under Studio:

| Endpoint |
|----------|
| `GET/POST /api/studio/workflows` |
| `GET/PUT/DELETE /api/studio/workflows/:id` |
| `GET /api/studio/workflow-runs` |
| `GET /api/studio/workflow-templates` |

## Fix for 404 on Render (`sentinal-z3ue.onrender.com`)

The production backend must be **redeployed** with this commit. Old deploys do not include `workflows.js` or the Studio mounts.

1. Push code to GitHub.
2. Render → your **backend** service → **Manual Deploy** (or auto-deploy on push).
3. After deploy, open `https://sentinal-z3ue.onrender.com/api/health` (should return `{"ok":true}`).
4. Logged-in request to `GET /api/studio/workflows` should return `{ success: true, data: ... }` (401 without JWT).

## Local dev (port 5173 / 5174)

- In `frontend/.env`, leave `VITE_API_URL` **empty** so Vite proxies `/api` → `http://localhost:5000`.
- If `backend/.env` has `PORT=5001`, either change it to `5000` or update `frontend/vite.config.js` proxy target to `5001`.
- Do **not** point local UI at production API unless production is redeployed.

## Quick test

1. Start backend + frontend.
2. Log in → Studio → **Workflow Studio** → New workflow.
3. Drag Input → AI → Output, connect, set input text in node config.
4. Fund burner wallet from header bar.
5. Run workflow → confirm → watch Execution panel + history.

## Creative workflow nodes (Gemini / Studio)

| Node type | Role |
|-----------|------|
| `promptGen` | Advanced Prompt Generator — upstream text is the goal |
| `imageGen` | Image Generator — 16:9 render from upstream prompt |

Template **Creative: Prompt → Image**: Input → Prompt Generator → Image Generator → Output.

Requires `GOOGLE_API_KEY` on the backend.
