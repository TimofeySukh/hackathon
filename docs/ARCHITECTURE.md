# Architecture

## Current Boundaries

The repository currently has a single-screen frontend architecture.

Runtime boundaries:

- React owns UI state and rendering.
- Vite owns local development and production bundling.
- CSS owns the visual board surface, theme tokens, and responsive layout.
- The browser owns theme persistence through `localStorage`.
- Supabase owns Google authentication and user-owned graph records.
- Linear owns task state, status, ownership, priority, and blockers.
- `docs/` owns durable product and repository knowledge.

The backend boundary remains intentionally narrow: Supabase Auth provides identity, and Supabase Postgres stores one private board plus its graph data for each signed-in user.

## Current Frontend Shape

- `src/main.tsx` mounts the React app.
- `src/App.tsx` contains the board interaction model and selected-person inspector.
- `src/lib/supabase.ts` creates the browser Supabase client from Vite environment variables.
- `src/lib/useAuth.ts` owns session loading, Google sign-in, and sign-out.
- `src/lib/useBoardGraph.ts` owns board graph loading and frontend mutation state.
- `src/lib/graphStorage.ts` owns Supabase CRUD for graph data.
- `src/lib/userWorkspace.ts` upserts the user profile and ensures a single personal board plus root node.
- `src/index.css` contains the full visual system.

The board is simulated by shifting layered CSS backgrounds according to a camera offset. The app does not store board objects or draw on a canvas element.

## Current Product Boundaries

The product is a navigable board foundation, not a whiteboard editor.

Current scope:

- mouse drag navigation
- dark/light theme switching
- very dense point-grid spatial reference
- compact motion-triggered point highlighting during mouse movement, drag, wheel pan, and zoom
- Google sign-in through Supabase
- one private personal board record per signed-in user
- one immutable root person at `0,0` for each signed-in user
- persistent people nodes with saved coordinates
- one reusable user-owned tag per person
- multiple notes per person
- at most one separate AI summary note per person
- undirected person-to-person connections

Out of scope for the current version:

- drawing tools
- sticky notes or cards
- camera state persistence
- multiplayer collaboration

## Invariants

- English only for documentation and user-facing text.
- Keep repository knowledge in `docs/`.
- Keep `AGENTS.md` as a short table of contents.
- Keep task status, ownership, and priority in Linear.
- Link implementation work back to the relevant Linear issue.
- Preserve the clean-board product principle from `docs/product-vision.md`.
- Keep all graph rows user-owned and protected by RLS keyed to `auth.uid()`.
- Keep the root person immutable in position and deletion semantics.
- Keep Google OAuth redirect/origin configuration aligned with the real deployed frontend origins.

## When The Repo Grows

- Describe top-level modules and ownership here.
- Record data boundaries, runtime assumptions, and integration points.
- Add any enforced conventions that future contributors should preserve.
- Move reusable UI into `src/components/` when `App.tsx` becomes too broad.
- Move product-specific behavior into `src/features/` once there is more than the board shell.
- Move shared helpers into `src/lib/` only when duplication or complexity justifies it.
