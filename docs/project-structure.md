# Project Structure

## Root Overview

### `AGENTS.md`

Project workflow rules and documentation update order.

### `README.md`

Top-level project overview, local setup instructions, and links to deeper documentation.

### `.env.mcp.example`

Template for local-only MCP server variables, including the Supabase service-role key.

### `.agents/skills/`

Project-scoped agent skills. The current installed skills provide Supabase workflow guidance and Supabase Postgres best practices for agents working in this repository.

### `docs/`

Detailed product and structure documentation.

`docs/PROBLEMS.md` tracks known open and resolved problems that should remain visible across work sessions.

### `mcp/`

Project-local MCP server files.

### `mobile/`

Flutter client scaffold with Android, iOS, and web platform targets. The current generated app lives in `mobile/lib/main.dart` and is not yet connected to the React prototype or Supabase data layer.

### `scripts/`

Local maintenance and seeding utilities. `seed-board.mjs` can bulk-create fake people on a board and optionally connect them to the root node. `seed-demo-user.mjs` can populate one user's board with a repeatable demo cluster that includes people, notes, AI summaries, and connections.

### `index.html`

The main HTML entry point used by Vite.

### `package.json`

Project metadata, scripts, and dependencies.

### `skills-lock.json`

Lockfile for project-scoped agent skills installed under `.agents/skills/`.

### `supabase/migrations/`

Supabase database migrations for profiles, personal boards, persisted graph data, and row-level security policies.

### `supabase/functions/`

Supabase Edge Functions. `sync-person-ai-note` sends person note context through the shared Gemini/OpenRouter AI provider layer and upserts `person_ai_notes`. `search-people-ai` sends graph candidates through the same provider layer and returns ranked natural-language search results.

### `src/`

Application source code.

### `.mcp.json`

Project MCP configuration for the local `hackathon-board` stdio server.

## Source Structure

### `src/main.tsx`

The React entry point. It mounts the app into the root DOM node.

### `src/App.tsx`

Contains the current visible performance prototype:

- deterministic 5,000-person orbit generation
- one Canvas 2D graph rendering layer
- camera refs for pan and zoom without per-frame React point rendering
- capped device pixel ratio for high-DPI performance
- spatial index based hover and click hit testing
- local generated-person search and centering
- lightweight React toolbar, stats panel, and selected-person panel

### `src/lib/`

Shared low-level helpers.

- `supabase.ts` creates the browser Supabase client from Vite environment variables.
- `useAuth.ts` owns session loading, Google OAuth sign-in, and sign-out.
- `useBoardGraph.ts` owns board graph loading, mutation state, and debounced AI note refresh scheduling per person.
- `graphStorage.ts` owns Supabase CRUD calls for persisted graph data, `person_ai_notes`, and AI Edge Function invocation.
- `graphTypes.ts` defines shared profile, board, person, note, AI note, tag, and connection interfaces, including the structured AI summary shape.
- `userWorkspace.ts` upserts profile data and ensures one personal board plus root person for the signed-in user.

### `mcp/server.mjs`

The local MCP server. It exposes:

- fixed documentation resources from `docs/`
- dynamic board and person JSON resources
- graph mutation tools backed by Supabase service-role access from local env

### `scripts/seed-board.mjs`

Bulk seed utility for local or MCP-enabled environments. It reads `.env.mcp.local`, inserts many people into a board, and can also create root-node connections for the new people.

### `scripts/seed-demo-user.mjs`

Demo data seed utility for local or MCP-enabled environments. It targets one user by email, ensures the required tags exist, upserts a fixed demo contact set, recreates their notes and AI summaries, and connects the cluster to the root person.

Supabase browser configuration reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. The older `VITE_SUPABASE_ANON_KEY` variable remains supported for compatibility.

### `src/index.css`

Contains the visual system for:

- the full-window graph shell
- canvas overlay chrome
- search and zoom toolbar controls
- render statistics panel
- selected-person detail panel
- responsive layout behavior

### `mobile/lib/main.dart`

Generated Flutter starter app entry point for the `mobile/` client scaffold.

## Current Technical Shape

The current visible prototype is intentionally minimal:

- React for state and rendering
- Vite for development and builds
- TypeScript for maintainability
- Supabase for Google auth and private user-owned records
- Canvas 2D for rendering thousands of graph points in one layer
- Flutter scaffold for future mobile and alternate web client work

## Interaction Model

The board is not an editor yet.

It currently supports:

- 5,000 generated people on many orbit rings around the center
- drawing all generated people every frame on a single canvas layer
- mouse and touch pointer panning
- cursor-centered mouse-wheel zoom
- toolbar zoom and reset controls
- local search by generated person name or number
- click selection and hover labels through a spatial hit index
- stats that report people count, drawn count, last frame time, and renderer

The visible graph is not currently connected to Supabase persistence.

## Extension Strategy

The project should evolve in controlled layers:

1. Preserve smooth navigation and visual clarity.
2. Add simple board objects only when the base movement feels solid.
3. Keep all graph persistence behind the dedicated data layer instead of calling Supabase directly from the UI.
4. Add advanced interactions only when they fit the clean-board principle.

## Future Folders We May Add

### `src/components/`

Reusable UI pieces such as toggles, overlays, and future board items.

### `src/features/`

Product-specific features such as persistence, board objects, or collaboration.

### `src/lib/`

Helpers, utilities, and shared low-level logic.

### `src/state/`

Centralized board or product state once the app grows beyond a single screen.

### `docs/decisions/`

Architecture decision records for important product and engineering choices.
