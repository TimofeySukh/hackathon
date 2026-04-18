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

Supabase database migrations for auth-adjacent product data, including profiles, personal boards, and row-level security policies.

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
- motion-triggered point highlight state
- social graph node and edge state
- drag-to-create node connections
- theme toggle
- infinite board surface positioning

### `src/lib/`

Shared low-level helpers.

- `supabase.ts` creates the browser Supabase client from Vite environment variables.
- `useAuth.ts` owns session loading, Google OAuth sign-in, sign-out, and workspace state.
- `userWorkspace.ts` upserts profile data and ensures one personal board for the signed-in user.

Supabase browser configuration reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. The older `VITE_SUPABASE_ANON_KEY` variable remains supported for compatibility.

### `src/index.css`

Contains the complete visual system for:

- dark and light themes
- account controls
- very dense point-grid background
- compact motion-triggered point highlight styling with directional tails for fast cursor movement
- compact graph node styling
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
- mouse drag navigation across the canvas
- trackpad and wheel-based navigation across the canvas
- cursor-centered zoom with the mouse wheel
- visual theme switching
- compact motion-triggered point highlighting during mouse movement, drag, wheel pan, and zoom
- social graph nodes connected by arrows
- drag-to-create node growth from any existing node with an immediate connecting line
- newly created nodes starting empty for immediate naming
- in-place node renaming
- grid movement through background offset changes

The visual board is simulated by shifting layered CSS backgrounds based on the current camera offset.

## Extension Strategy

The project should evolve in controlled layers:

1. Preserve smooth navigation and visual clarity.
2. Add simple board objects only when the base movement feels solid.
3. Keep account persistence separate from board content persistence until the object model is clear.
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
