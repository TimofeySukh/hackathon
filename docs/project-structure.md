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

- Supabase-backed account controls
- theme state
- mouse drag navigation state
- board zoom state
- top-left tag menu state
- board viewport and camera state
- selected-person inspector state
- people search overlay state
- persisted social graph node and connection rendering
- drag node repositioning
- platform-native modifier drag for node connection creation: `Command` on macOS, `Control` elsewhere
- theme toggle
- infinite board surface positioning

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

Contains the complete visual system for:

- dark and light themes
- account controls
- people search panel with rounded results and dismissible overlay behavior
- very dense point-grid background
- dense board grid styling and layered graph presentation
- compact graph node styling
- top-left tag menu and color palette styling
- graph edge styling and preview connection styling
- responsive layout behavior

## Current Technical Shape

The application is intentionally minimal:

- React for state and rendering
- Vite for development and builds
- TypeScript for maintainability
- Supabase for Google auth and private user-owned records
- Custom CSS-based board rendering

## Interaction Model

The board is not an editor yet.

It currently supports:

- Google sign-in and sign-out when Supabase is configured
- one personal board record per signed-in user
- one immutable root node at `0,0` per signed-in user
- mouse drag navigation across the canvas
- one-finger touch drag navigation across the canvas on mobile devices
- two-finger touch pinch zoom across the canvas on mobile devices, centered on the pinch midpoint
- trackpad scroll panning across the canvas
- cursor-centered zoom with the mouse wheel
- visual theme switching
- persistent social graph nodes connected by lines
- one separate AI summary record per person in the database with `status`, plain-text `summary`, structured JSON data, and sync error state
- modifier-drag to connect two existing nodes by releasing on another node hit area: `Command` on macOS, `Control` elsewhere
- modifier-drag to create node growth from any existing node with an immediate connecting line: `Command` on macOS, `Control` elsewhere
- selected-node detail cards with a large name field, searchable tag selection/creation/deletion, compact auto-saving notes, and person deletion
- single-click opening for the node-anchored inspector
- a scrollable top-left tag menu that supports long tag lists and lower-row color palette editing
- automatic board panning to keep the node-anchored inspector inside the viewport
- inspector opening at a consistent size regardless of current zoom, then scaling with later zoom changes
- continued trackpad panning over the inspector when the gesture starts on the board
- connection line selection with a widened hit target, inline deletion, and Backspace deletion
- a compact top bar with a capped-width search field, circular tags/account/theme controls, and exclusive overlay behavior
- a keyboard-first inspector that treats `#tag` in the name field as a tag command and uses one capture textarea for new notes
- local people search while typing plus natural-language AI search on Enter
- drag repositioning for non-root nodes
- persisted node renaming
- grid movement through background offset changes
- mobile-safe control placement with the primary search/account/theme row at the top and the Tags menu docked near the bottom-left edge

The visual board is simulated by shifting layered CSS backgrounds based on the current camera offset.

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
