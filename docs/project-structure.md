# Project Structure

For a concise product summary see [`AI_CONTEXT.md`](AI_CONTEXT.md).

## Root Overview

| Path | Role |
|------|------|
| `AGENTS.md` | Short agent entrypoint; points to `docs/`. |
| `README.md` | Top-level overview and local dev quick start. |
| `docs/` | Product and repository knowledge (source of truth). |
| `src/` | Application source. |
| `supabase/` | Migrations and Edge Functions. |
| `scripts/` | CLI, MCP, load tests, local LinkedIn agent search. |
| `deploy/` | Production and optional cloud test deploy assets. |
| `public/staticwebapp.config.json` | Azure Static Web Apps SPA fallback and security headers, copied into `dist/` by Vite. |
| `.agents/skills/` | Project-scoped agent skills (Supabase). |
| `index.html` | Vite HTML entry. |
| `package.json` | Dependencies and npm scripts. |

## Source: `src/`

### Entry and pages

- `main.tsx` — mounts `App`.
- `App.tsx` — hash router views, board shell, inspector, settings, graph state, paint loop,
  LinkedIn import, search, auth dialog, agent settings overlay.
- `LandingPage.tsx` — marketing landing (`#`).
- `DocsPage.tsx` — developer documentation (`#docs`) — API, CLI, MCP setup.
- `ContactPage.tsx` — team contact (`#contact`).
- `PrivacyPage.tsx` — privacy policy (`#privacy`).

### `src/lib/board/` (framework-free board engine)

| File | Role |
|------|------|
| `types.ts` | Board domain and interaction types. |
| `constants.ts` | Camera limits, collision tuning, tones, link services. |
| `colors.ts` | Tone resolution and color helpers. |
| `geometry.ts` | Node shape paths. |
| `layout.ts` | Containment, collision, `createFreshGraph`, import packing. |
| `render.ts` | Spatial index, hit-test, Canvas 2D draw layer. |

### `src/lib/` (shared logic)

| File | Role |
|------|------|
| `supabase.ts` | Browser Supabase client from Vite env vars. |
| `useAuth.ts` | Session, Google/email auth, recovery, sign-out. |
| `graphPersistence.ts` | Load/save graph blob; Realtime; revision conflicts. |
| `agentApi.ts` | Agent token CRUD via graph API. |
| `agentBoardContext.ts` | Agent-facing board context helpers. |
| `linkedinEnrichment.ts` | Single-profile enrichment Edge Function client. |
| `smartSearch.ts` | Client for smart search API. |
| `search/graphSearch.ts` | Local deterministic graph search/ranking. |
| `tagPalette.ts` | Shared tag color palette. |
| `stressTest.ts` | Dev-only synthetic graph harness (`STRESS_TEST_ENABLED` in App). |

### `src/components/`

- `M3Slider.tsx` — Material 3 slider (incl. wavy variant).
- `SelectionIndicator.tsx` — sliding pill / shape-morph selection motion.
- `TiltContainer.tsx` — landing card tilt effect.

### `src/styles/`

`index.css` imports partials in cascade order: `base`, `theme`, `chrome`, `board`,
`inspector`, `inspector-fields`, `panels`, `widgets`, `landing`, `docs`, `privacy`, …

## Supabase

### `supabase/migrations/`

- `user_graphs` JSONB blob per user, RLS keyed to `auth.uid()`.
- Optimistic concurrency (`revision`).
- `agent_tokens` (hashed).
- Realtime publication on `user_graphs`.

### `supabase/functions/`

| Function | Role |
|----------|------|
| `graph-api/` | User/agent graph API: meta, search, smart search, CRUD, operations batch. |
| `enrich-linkedin-profile/` | Authenticated single-profile LinkedIn enrichment. |

## Scripts

| Script | Role |
|--------|------|
| `datanode-cli.mjs` | CLI client for graph API. |
| `datanode-mcp.mjs` | Stdio MCP server for agents. |
| `linkedin-agent-search.mjs` | Local read-only JSONL search (not hosted). |
| `test-database-load.mjs` | Synthetic `user_graphs` payload load test (dry-run default). |
| `test-ui-import-responsiveness.mjs` | Playwright LinkedIn ZIP lag check. |
| `test-ui-import-persistence.mjs` | Mock-auth import persistence E2E. |

## Environment variables (browser)

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY` (preferred) or `VITE_SUPABASE_ANON_KEY`

Optional local-only:

- `VITE_LINKEDIN_ENRICHMENT_TEST_SECRET` — enrichment test bypass (never production).

Edge Function secrets (Supabase dashboard / CLI): `SUPABASE_SERVICE_ROLE_KEY`,
`LINKEDIN_ENRICHMENT_API_KEY`, `AI_SEARCH_API_KEY`, … — see [`RUNBOOK.md`](RUNBOOK.md).

## Technical stack

- React + TypeScript + Vite
- Canvas 2D board renderer
- Supabase Auth + Postgres JSONB + Edge Functions + Realtime
- npm; lockfile via `package-lock.json`
