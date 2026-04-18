# Architecture

## Current Boundaries

The repository currently has a single-screen frontend architecture.

Runtime boundaries:

- React owns UI state and rendering.
- Vite owns local development and production bundling.
- CSS owns the visual board surface, theme tokens, and responsive layout.
- The browser owns theme persistence through `localStorage`.
- Linear owns task state, status, ownership, priority, and blockers.
- `docs/` owns durable product and repository knowledge.

There is no backend boundary yet.

## Current Frontend Shape

- `src/main.tsx` mounts the React app.
- `src/App.tsx` contains the current board interaction model.
- `src/index.css` contains the full visual system.

The board is simulated by shifting layered CSS backgrounds according to a camera offset. The app does not store board objects or draw on a canvas element.

## Current Product Boundaries

The product is a navigable board foundation, not a whiteboard editor.

Current scope:

- mouse drag navigation
- dark/light theme switching
- point-grid spatial reference

Out of scope for the current version:

- drawing tools
- sticky notes or cards
- side panels
- persistence of board content
- authentication
- backend storage
- multiplayer collaboration

## Invariants

- English only for documentation and user-facing text.
- Keep repository knowledge in `docs/`.
- Keep `AGENTS.md` as a short table of contents.
- Keep task status, ownership, and priority in Linear.
- Link implementation work back to the relevant Linear issue.
- Preserve the clean-board product principle from `docs/product-vision.md`.
- Do not introduce backend or persistence concepts until the object model is clear.

## When The Repo Grows

- Describe top-level modules and ownership here.
- Record data boundaries, runtime assumptions, and integration points.
- Add any enforced conventions that future contributors should preserve.
- Move reusable UI into `src/components/` when `App.tsx` becomes too broad.
- Move product-specific behavior into `src/features/` once there is more than the board shell.
- Move shared helpers into `src/lib/` only when duplication or complexity justifies it.
