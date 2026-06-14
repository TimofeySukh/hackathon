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

### `mcp/`

Project-local MCP server files.

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

Contains the board experience:

- local seed graph state for circles and people
- a central `You` circle
- external connected circles and nested subset circles
- branch creation from a circle context menu or Shift-dragging a circle center
- a creation menu for people, nested subset circles, and external connected circles
- people as endpoint nodes that cannot create outgoing branches
- selected-circle and selected-person inspector state
- local renaming of selected objects
- demo-person insertion into the selected circle
- person dragging
- circle-center dragging for every circle, including `You`
- subtree movement for contained people and child circles
- circle resizing by dragging the circle edge
- automatic containment fit, including shrink-back, when people or child circles cross a parent boundary
- pan and zoom camera state
- curved Canvas 2D links between circle centers, circles, and people

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

### `scripts/test-database-load.mjs`

Synthetic persistence load test for the current `user_graphs.graph` blob model. It is dry-run by default and can only write to staging-like Supabase environments after explicit opt-in with `HACKATHON_ALLOW_DATABASE_LOAD_TEST=true`; it refuses the `.env.production` Supabase URL.

### `scripts/test-ui-import-responsiveness.mjs`

Playwright-based browser responsiveness check for large LinkedIn ZIP imports. It starts or targets a local Vite server, uploads a generated `Connections.csv` ZIP through the real UI, and fails when measured event-loop lag exceeds the threshold.

Supabase browser configuration reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. The older `VITE_SUPABASE_ANON_KEY` variable remains supported for compatibility.

### `src/index.css`

Contains the complete visual system for:

- the light grid board surface
- dashed relationship circle boundaries
- circle center nodes and branch handles
- compact person tiles
- curved graph edge styling and draft connection styling
- top toolbar controls
- in-page help panel
- creation menu
- selected-item inspector
- responsive layout behavior

## Current Technical Shape

The application is intentionally minimal:

- React for state and rendering
- Vite for development and builds
- TypeScript for maintainability
- local browser-session state for the visible prototype
- existing Supabase data-layer files remain available for future persisted product work

## Interaction Model

The branch is a local interface prototype, not a persisted editor yet.

It currently supports:

- a central root circle named `You`
- seeded connected group circles
- seeded nested subset circles
- seeded people inside circles and subsets
- creating a person from a circle context menu or Shift-drag create flow
- creating a nested subset circle from the same creation menu
- creating a connected external circle from the same creation menu
- selecting and renaming circles or people in the inspector
- adding three demo people to the selected circle
- dragging people
- moving every circle, including `You`, with its contained people and subset circles
- resizing circles from their edge
- automatic radius expansion and shrink-back through parent chains when contained objects move
- mouse drag navigation across empty board space
- cursor-centered zoom with the mouse wheel
- toolbar zoom buttons and reset
- local state only for the current browser session

The visual board uses CSS grid backgrounds plus a Canvas 2D board layer for graph objects, links, labels, hover, selection, resize handles, and draft connectors. React DOM is reserved for chrome, menus, panels, and inspector UI.

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
