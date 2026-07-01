# Architecture

For a concise product summary see [`AI_CONTEXT.md`](AI_CONTEXT.md).

## Current Boundaries

The repository is a single-page application with a hash-based view router and one primary
interactive surface (the board).

Runtime boundaries:

- React owns application state, chrome, panels, inspector, and the imperative board paint loop.
- `src/lib/board/` owns framework-free canvas geometry, layout, rendering, and hit-testing.
- Vite owns local development and production bundling.
- CSS (`src/styles/`) owns Material 3 tokens and chrome/board styling.
- Supabase owns Google/email auth, `user_graphs` blob storage, revisions, Realtime, and
  hashed agent tokens.
- Supabase Edge Functions own LinkedIn profile enrichment and the agent graph API.
- Linear owns task state; `docs/` owns durable product and repository knowledge.

The board is a live product. Signed-in users load and autosave through Supabase with
revision checks and Realtime sync. Anonymous visitors edit a board persisted to
`localStorage`. A brand-new board is blank: a single `You` circle — **no demo seed**.

## Current Frontend Shape

- `src/main.tsx` mounts the React app.
- `src/App.tsx` is the shell and interaction host: hash routing (landing, board, docs,
  contact, privacy), chrome/panels, pointer interaction, camera, persisted-graph wiring,
  and the paint loop. Heavy canvas logic lives in `src/lib/board/`.
- `src/LandingPage.tsx`, `DocsPage.tsx`, `ContactPage.tsx`, `PrivacyPage.tsx` — public routes.
- `src/lib/board/` — types, constants, colors, geometry, layout, render (spatial index,
  hit-testing, Canvas 2D).
- `src/lib/graphPersistence.ts` — signed-in saves via `graph-api` first, RLS fallback,
  Realtime subscription, revision conflicts.
- `src/lib/agentApi.ts` — agent token management from Settings.
- `src/lib/useAuth.ts` — session and auth flows.
- `src/lib/smartSearch.ts`, `src/lib/search/graphSearch.ts` — smart and local search.
- `supabase/functions/enrich-linkedin-profile/` — authenticated single-profile enrichment.
- `supabase/functions/graph-api/` — session or agent-token graph API for browser, CLI, MCP.
- `src/index.css` + `src/styles/` — Material 3 chrome and board styling.

The board hot path is Canvas 2D: circles, people, labels, edges, handles, draft connector.
React owns surrounding UI. Pointer events use canvas hit-testing against a spatial grid.

## Current Product Boundaries

Current scope:

- central `You` circle, connected external circles, nested subset circles, people
- create menu, double-tap create, connector drag-to-create
- edit / select (marquee) / pan tool modes
- selection, dragging, group drag, resize, merge-into-subset
- pan, cursor-centered wheel/pinch zoom, zones-only far zoom, inertial pan on mobile
- Google and email/password auth; revision-checked Supabase autosave + Realtime sync
- anonymous `localStorage` editing
- LinkedIn ZIP import and signed-in single-profile enrichment
- per-person notes, tags, connections inside the graph blob
- board search and signed-in smart search
- landing, docs, contact, privacy pages
- revocable agent tokens, graph API, CLI, stdio MCP server

Out of scope (not built):

- real-time multiplayer / presence
- drawing tools and sticky notes
- demo mode and demo seed graphs
- global light/dark theme toggle (Material 3 light tokens only today)

## Invariants

- English only for documentation and user-facing text.
- Keep repository knowledge in `docs/`.
- Keep `AGENTS.md` as a short table of contents.
- Keep task status, ownership, and priority in Linear.
- Link implementation work back to the relevant Linear issue.
- Preserve the clean-board product principle from `docs/product-vision.md`.
- Keep all graph rows user-owned and protected by RLS keyed to `auth.uid()`.
- Keep graph writes revision-checked. A stale browser tab, CLI, or MCP agent must get a
  conflict instead of overwriting newer data.
- Keep agent tokens hashed at rest, scoped, revocable, and mapped to one user. API
  callers never provide `user_id`.
- Never let a missing graph row silently overwrite a user's server data with a blank
  fresh graph; fallback or fail visibly before autosave.
- Keep unsigned local graph data out of Supabase until the user signs in and an explicit migration path exists.
- Keep LinkedIn enrichment provider API keys out of the browser and only inside Supabase Edge Function secrets.
- Keep the root person immutable in position and deletion semantics.
- Keep Google OAuth and Supabase email redirect/origin configuration aligned with the real deployed frontend origins.

## When The Repo Grows

- Describe top-level modules and ownership here.
- Record data boundaries, runtime assumptions, and integration points.
- Add any enforced conventions that future contributors should preserve.
- Move reusable UI into `src/components/` when `App.tsx` becomes too broad.
- Move product-specific behavior into `src/features/` once there is more than the board shell.
- Move shared helpers into `src/lib/` only when duplication or complexity justifies it.
