# Architecture

## Current Boundaries

The repository currently has a single-screen frontend architecture for a folder graph viewer.

Runtime boundaries:

- React owns UI state and rendering.
- Vite owns local development and production bundling.
- CSS owns the visual graph surface, theme tokens, and responsive layout.
- The browser owns theme persistence through `localStorage`.
- Supabase owns Google authentication and user-owned profile and board records.
- Linear owns task state, status, ownership, priority, and blockers.
- `docs/` owns durable product and repository knowledge.

The backend boundary is intentionally narrow: Supabase Auth provides identity, and Supabase Postgres stores one personal graph-space board record per signed-in user.

## Current Frontend Shape

- `src/main.tsx` mounts the React app.
- `src/App.tsx` contains the current folder graph interaction model.
- `src/lib/supabase.ts` creates the browser Supabase client from Vite environment variables.
- `src/lib/useAuth.ts` owns session loading, Google sign-in, sign-out, and workspace bootstrapping.
- `src/lib/userWorkspace.ts` upserts the user profile and ensures a single personal board.
- `src/index.css` contains the full visual system.

The graph surface is simulated by shifting layered CSS backgrounds according to a camera offset while graph nodes and SVG edges render in a transformed world layer. The app does not store graph content outside the bundled demo datasets yet.

## Current Product Boundaries

The product is a navigable folder graph viewer, not a graph editor.

Current scope:

- folder switching from the sidebar
- mouse drag navigation
- dark/light theme switching
- point-grid spatial reference
- graph node and edge rendering from demo folder datasets
- compact motion-triggered point highlighting during mouse movement, drag, wheel pan, and zoom
- Google sign-in through Supabase
- one private personal graph-space board record per signed-in user

Out of scope for the current version:

- graph editing tools
- note creation UI
- persistence of graph content or camera state
- filters and search
- multiplayer collaboration

## Invariants

- English only for documentation and user-facing text.
- Keep repository knowledge in `docs/`.
- Keep `AGENTS.md` as a short table of contents.
- Keep task status, ownership, and priority in Linear.
- Link implementation work back to the relevant Linear issue.
- Preserve the graph exploration product principle from `docs/product-vision.md`.
- Keep Supabase storage limited to account and graph-space ownership until the real graph data model is clear.

## When The Repo Grows

- Describe top-level modules and ownership here.
- Record data boundaries, runtime assumptions, and integration points.
- Add any enforced conventions that future contributors should preserve.
- Move reusable UI into `src/components/` when `App.tsx` becomes too broad.
- Move product-specific behavior into `src/features/` once there is more than the graph shell.
- Move shared helpers into `src/lib/` only when duplication or complexity justifies it.
