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

Supabase Edge Functions. `sync-person-ai-note` sends person note context through the shared Gemini/OpenRouter AI provider layer and upserts `person_ai_notes`. `search-people-ai` sends graph candidates through the same provider layer and returns ranked natural-language search results. `enrich-linkedin-profile` calls the configured profile provider for signed-in manual one-profile LinkedIn imports.

### `src/`

Application source code.

### `.mcp.json`

Project MCP configuration for the local `hackathon-board` stdio server.

## Source Structure

### `src/main.tsx`

The React entry point. It mounts the app into the root DOM node.

### `src/App.tsx`

The React shell and interaction host for the board. It is large but now delegates
the heavy canvas work to `src/lib/board/` (see below). App.tsx owns:

- chrome and panels: toolbar, brand, board search, settings panel, LinkedIn sync
  guide, create menu, and the selected-item inspector (name, tags, notes,
  connections)
- graph state and persistence wiring: starts from a blank `createFreshGraph`
  (the old demo seed is gone), then loads the signed-in user's graph from
  Supabase or the anonymous board from `localStorage`, with debounced autosave
- all pointer interaction: pan/zoom (wheel + pinch), node/zone dragging,
  marquee (right-click) selection, group dragging of mixed selections, circle
  resizing, connector drag, and the merge-into-subset action
- camera state and the cursor model (hand while panning/dragging, pointer over
  nodes, arrow at rest)
- the imperative paint loop that drives `drawBoardLayer` per animation frame
- LinkedIn ZIP / single-profile import flows and undo history

> Note: App.tsx is still the biggest file. When adding board-engine logic
> (rendering, hit-testing, layout math, colors, geometry), put it in the
> matching `src/lib/board/` module, not here.

### `src/lib/board/`

Pure, framework-free board engine extracted from App.tsx. No React, no DOM
ownership — these take plain data and return data (or draw to a passed canvas
context). This is where the bulk of the canvas logic now lives.

- `types.ts` — shared board domain + interaction types (`CircleNode`,
  `PersonNode`, `GraphState`, `Camera`, `BoardIndex`, `BoardHit`, etc.).
- `constants.ts` — camera limits, hit-test sizes, collision/layout tuning, the
  Material tone palette, color presets, link-service options.
- `colors.ts` — tone resolution and hex/rgb/hsv conversion + mixing.
- `geometry.ts` — node-shape path building, canvas path helpers, `clamp`,
  segment distance, collision separation.
- `layout.ts` — containment fitting and collision relaxation
  (`ensureContainment`), circle resize, `makeCircle`, `createFreshGraph`,
  descendant/subtree helpers.
- `render.ts` — the canvas engine: spatial index (`createBoardIndex`, queries),
  pointer hit-testing (`hitTestBoard`), and the full Canvas 2D draw layer
  (`drawBoardLayer` and all `draw*` helpers, sprites, image cache).

### `src/lib/`

Shared low-level helpers and the Supabase data layer.

- `supabase.ts` creates the browser Supabase client from Vite environment variables.
- `useAuth.ts` owns session loading, Google OAuth sign-in, and sign-out.
- `useBoardGraph.ts` owns board graph loading, mutation state, and debounced AI note refresh scheduling per person.
- `graphStorage.ts` owns Supabase CRUD calls for persisted graph data, `person_ai_notes`, and AI Edge Function invocation.
- `graphPersistence.ts` owns the load/save of the whole graph blob (`loadGraph`/`saveGraph` for signed-in users, `loadLocalGraph`/`saveLocalGraph` for anonymous browser sessions).
- `linkedinEnrichment.ts` calls the profile enrichment Edge Function for single-profile LinkedIn imports.
- `tagPalette.ts` holds the shared tag color palette.
- `stressTest.ts` is the dev-only performance harness that generates large synthetic graphs.
- `graphTypes.ts` defines shared profile, board, person, note, AI note, tag, and connection interfaces, including the structured AI summary shape.
- `userWorkspace.ts` upserts profile data and ensures one personal board plus root person for the signed-in user.

### `src/styles/`

`src/index.css` is now just an ordered list of `@import`s; the actual rules live
in logical partials under `src/styles/` (`base`, `theme`, `chrome`, `board`,
`inspector`, `inspector-fields`, `panels`, `widgets`). The import order in
`index.css` is the cascade order — keep it; later files override earlier ones at
equal specificity.

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

Entry stylesheet — now just an ordered list of `@import`s pulling in the
partials under `src/styles/` (see the `src/styles/` section above). The visual
system (board surface, chrome, inspector, panels, widgets) lives in those
partials; the import order is the cascade order.

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
