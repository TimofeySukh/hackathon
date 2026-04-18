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

### `index.html`

The main HTML entry point used by Vite.

### `package.json`

Project metadata, scripts, and dependencies.

### `skills-lock.json`

Lockfile for project-scoped agent skills installed under `.agents/skills/`.

### `supabase/migrations/`

Supabase database migrations for profiles, personal boards, persisted graph data, and row-level security policies.

### `src/`

Application source code.

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
- motion-triggered point highlight state
- selected-person inspector state
- persisted social graph node and connection rendering
- drag-to-create node connections
- shift-drag node repositioning
- theme toggle
- infinite board surface positioning

### `src/lib/`

Shared low-level helpers.

- `supabase.ts` creates the browser Supabase client from Vite environment variables.
- `useAuth.ts` owns session loading, Google OAuth sign-in, and sign-out.
- `useBoardGraph.ts` owns board graph loading and mutation state.
- `graphStorage.ts` owns Supabase CRUD calls for persisted graph data.
- `graphTypes.ts` defines shared profile, board, person, note, AI note, tag, and connection interfaces.
- `userWorkspace.ts` upserts profile data and ensures one personal board plus root person for the signed-in user.

Supabase browser configuration reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. The older `VITE_SUPABASE_ANON_KEY` variable remains supported for compatibility.

### `src/index.css`

Contains the complete visual system for:

- dark and light themes
- account controls
- very dense point-grid background
- compact motion-triggered point highlight styling with directional tails for fast cursor movement
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
- trackpad scroll panning across the canvas
- cursor-centered zoom with the mouse wheel
- visual theme switching
- persistent social graph nodes connected by lines
- one separate AI summary record per person in the database
- drag-to-connect two existing nodes by releasing on another node hit area
- drag-to-create node growth from any existing node with an immediate connecting line
- selected-node detail cards with reusable tag selection, note editing, connection removal, and deletion
- shift-drag repositioning for non-root nodes
- persisted node renaming
- grid movement through background offset changes

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
