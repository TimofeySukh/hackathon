# Project Structure

## Root Overview

### `AGENTS.md`

Project workflow rules and documentation update order.

### `README.md`

Top-level project overview, local setup instructions, and links to deeper documentation.

### `.agents/skills/`

Project-scoped agent skills. The current installed skills provide Supabase workflow guidance and Supabase Postgres best practices for agents working in this repository.

### `docs/`

Detailed product and structure documentation.

### `scripts/`

Local verification utilities. The current scripts cover `user_graphs` payload load checks and browser responsiveness during large LinkedIn ZIP imports.

### `index.html`

The main HTML entry point used by Vite.

### `package.json`

Project metadata, scripts, and dependencies.

### `skills-lock.json`

Lockfile for project-scoped agent skills installed under `.agents/skills/`.

### `supabase/migrations/`

Supabase database migrations for the current `user_graphs` blob storage model and row-level security policies.

### `supabase/functions/`

Supabase Edge Functions. The active function is `enrich-linkedin-profile`, which calls the configured profile provider for signed-in manual one-profile LinkedIn imports.

### `src/`

Application source code.

## Source Structure

### `src/main.tsx`

The React entry point. It mounts the app into the root DOM node.

### `src/App.tsx`

The React shell and interaction host for the board. It is large but delegates the heavy canvas work to `src/lib/board/`. App.tsx owns:

- chrome and panels: toolbar, brand, board search, settings panel, LinkedIn sync guide, create menu, and the selected-item inspector
- graph state and persistence wiring: signed-in users load/save `user_graphs.graph`; anonymous users load/save `localStorage`
- all pointer interaction: pan/zoom, dragging, marquee selection, resizing, connector drag, and merge-into-subset
- camera state and the cursor model
- the imperative paint loop that drives `drawBoardLayer`
- LinkedIn ZIP / single-profile import flows and undo history

### `src/lib/board/`

Pure, framework-free board engine extracted from App.tsx.

- `types.ts` — shared board domain + interaction types.
- `constants.ts` — camera limits, hit-test sizes, collision/layout tuning, Material tones, color presets, and link-service options.
- `colors.ts` — tone resolution and color conversion helpers.
- `geometry.ts` — node-shape path building and geometry helpers.
- `layout.ts` — containment fitting, collision relaxation, circle resize, `makeCircle`, `createFreshGraph`, and subtree helpers.
- `render.ts` — spatial index, pointer hit-testing, and the full Canvas 2D draw layer.

### `src/lib/`

Shared helpers and active Supabase integration.

- `supabase.ts` creates the browser Supabase client from Vite environment variables.
- `useAuth.ts` owns session loading, Google OAuth sign-in, email/password auth, confirmation resend, password recovery, and sign-out.
- `graphPersistence.ts` owns the current graph blob storage path (`loadGraph`/`saveGraph` for signed-in users, `loadLocalGraph`/`saveLocalGraph` for anonymous browser sessions).
- `linkedinEnrichment.ts` calls the LinkedIn profile enrichment Edge Function for single-profile imports.
- `tagPalette.ts` holds the shared tag color palette.
- `stressTest.ts` is the dev-only performance harness that generates large synthetic graphs.

### `src/styles/`

`src/index.css` is an ordered list of `@import`s; the actual rules live in logical partials under `src/styles/` (`base`, `theme`, `chrome`, `board`, `inspector`, `inspector-fields`, `panels`, `widgets`). The import order in `index.css` is the cascade order.

### `scripts/test-database-load.mjs`

Synthetic persistence load test for the current `user_graphs.graph` blob model. It is dry-run by default and can only write to staging-like Supabase environments after explicit opt-in with `HACKATHON_ALLOW_DATABASE_LOAD_TEST=true`; it refuses the `.env.production` Supabase URL.

### `scripts/test-ui-import-responsiveness.mjs`

Playwright-based browser responsiveness check for large LinkedIn ZIP imports. It starts or targets a local Vite server, uploads a generated `Connections.csv` ZIP through the real UI, and fails when measured event-loop lag exceeds the threshold.

Supabase browser configuration reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. The older `VITE_SUPABASE_ANON_KEY` variable remains supported for compatibility.

## Current Technical Shape

- React for state and rendering
- Vite for development and builds
- TypeScript for maintainability
- Supabase Auth for Google and email/password sign-in
- `user_graphs.graph` JSONB blob for signed-in board persistence
- `localStorage` for signed-out board persistence
- one Supabase Edge Function for server-side LinkedIn profile enrichment
