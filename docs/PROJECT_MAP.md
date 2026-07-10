# Project Map

## Start Here (for humans and AI)

1. [`AI_CONTEXT.md`](AI_CONTEXT.md) — canonical, code-aligned product summary (read first).
2. [`RUNBOOK.md`](RUNBOOK.md) — commands, env, deploy, verification.
3. [`ARCHITECTURE.md`](ARCHITECTURE.md) — boundaries and invariants.
4. [`features/README.md`](features/README.md) — per-feature behavior and design.

## Current State

Social Datanode is a live React + Vite + TypeScript product (not a local-only prototype):

- Full-window relationship circle graph on Canvas 2D; React owns chrome, panels, persistence.
- Blank new board: central `You` circle only — **no demo seed**.
- Circles (nested groups), people, authored connections, pan/zoom, direct touch controls.
- Create menu, double-tap create, drag, marquee select, resize, merge-into-subset.
- Google and email/password auth; per-user graph in Supabase (revision-checked autosave);
  anonymous editing in `localStorage`.
- LinkedIn ZIP import + signed-in single-profile/archive enrichment; board search + smart search.
- Revocable agent tokens; graph API; CLI (`datanode-cli`); MCP server (`datanode-mcp`).
- Landing page, developer docs page, and contact page (hash routes).
- Material 3 design language for chrome and board-adjacent UI.

Removed from the product (do not document as current): demo mode, demo seed graph, global
theme toggle, stress-test slider panel, floating anonymous sign-in banner.

## Active Work

- Linear project: [Hackathon](https://linear.app/velizard/project/hackathon-fc67889adc0d)
- Team: `Velizard`
- Source of truth for tasks, owners, priority, and status: Linear

## Important Files

### Agent entrypoints

- `AGENTS.md` — short rules and doc index for coding agents.
- `docs/AI_CONTEXT.md` — canonical product summary for AI/human onboarding.

### Application

- `src/main.tsx` — React entry.
- `src/App.tsx` — shell: routing, board interaction host, inspector, settings, persistence wiring (~7k lines).
- `src/LandingPage.tsx`, `src/DocsPage.tsx`, `src/ContactPage.tsx` — public screens.
- `src/lib/board/` — framework-free board engine (types, geometry, layout, render, hit-test).
- `src/lib/graphPersistence.ts` — load/save, Realtime, revision conflicts.
- `src/lib/useAuth.ts` — Supabase auth session and flows.
- `src/lib/agentApi.ts` — agent token management from Settings.
- `src/lib/smartSearch.ts`, `src/lib/search/` — local and smart search.
- `src/lib/linkedinEnrichment.ts` — client for profile enrichment Edge Function.
- `src/lib/linkedinArchiveEnrichment.ts` — client for archive LLM enrichment Edge Function.
- `src/components/` — shared M3 UI (`M3Slider`, `SelectionIndicator`, …).
- `src/styles/` + `src/index.css` — Material 3 tokens and feature styles.

### Backend and tools

- `supabase/migrations/` — schema, RLS, revisions, agent tokens, Realtime.
- `supabase/functions/graph-api/` — agent/user graph API.
- `supabase/functions/enrich-linkedin-profile/` — LinkedIn profile enrichment.
- `supabase/functions/enrich-linkedin-archive/` — LinkedIn archive LLM enrichment.
- `scripts/datanode-cli.mjs`, `scripts/datanode-mcp.mjs` — CLI and MCP.
- `scripts/linkedin-agent-search.mjs` — local read-only JSONL search for agents.
- `scripts/test-database-load.mjs`, `scripts/test-ui-import-*.mjs` — import load tests.

### Docs

- `docs/PROJECT_MAP.md` — this file.
- `docs/RUNBOOK.md`, `docs/ARCHITECTURE.md`, `docs/project-structure.md`.
- `docs/product-vision.md`, `docs/DESIGN_SYSTEM.md`, `docs/DESIGN_LOG.md`.
- `docs/features/` — one doc per user-facing feature.
- `docs/AGENT_BEST_PRACTICES.md` — MCP/API agent rules.

### Deploy

- `.github/workflows/deploy-social-datanode-live.yml` — production promotion to `production` branch.
- `.github/workflows/deploy-datanode-digitalocean-test.yml` — manual DigitalOcean test deploy.
- `.github/workflows/shutdown-datanode-digitalocean-test.yml` — manual DigitalOcean test app deletion.
- `.github/workflows/deploy-datanode-azure-test.yml` — manual Azure Static Web Apps test deploy.
- `deploy/social-datanode-live/`, `deploy/digitalocean-app-platform/`.
- `public/staticwebapp.config.json` — Azure Static Web Apps fallback and security headers.

## Ownership

Task ownership is tracked in Linear. Code ownership is not split by directory yet.

## Next Steps

- Link implementation work to the relevant Linear issue.
- When behavior changes: update `docs/AI_CONTEXT.md`, the relevant feature doc, and
  `docs/RUNBOOK.md` if commands or verification change.
- When API/CLI/MCP changes: also update `src/DocsPage.tsx` (developer docs on the site).
- Keep Supabase Auth redirect URLs and Google OAuth origins aligned with every deployed frontend origin.
- Production deploys only after manual promotion to the `production` branch; the home server polls that branch from cron.
