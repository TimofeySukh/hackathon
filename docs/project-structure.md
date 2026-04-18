# Project Structure

## Root Overview

### `AGENTS.md`

Project workflow rules and documentation update order.

### `README.md`

Top-level project overview, local setup instructions, and links to deeper documentation.

### `docs/`

Detailed product and structure documentation.

### `index.html`

The main HTML entry point used by Vite.

### `package.json`

Project metadata, scripts, and dependencies.

### `src/`

Application source code.

## Source Structure

### `src/main.tsx`

The React entry point. It mounts the app into the root DOM node.

### `src/App.tsx`

Contains the board experience:

- theme state
- mouse drag navigation state
- board zoom state
- theme toggle
- infinite board surface positioning

### `src/index.css`

Contains the complete visual system for:

- dark and light themes
- point-grid background
- board overlay styling
- responsive layout behavior

## Current Technical Shape

The application is intentionally minimal:

- React for state and rendering
- Vite for development and builds
- TypeScript for maintainability
- Custom CSS-based board rendering

## Interaction Model

The board is not an editor yet.

It currently supports:

- mouse drag navigation across the canvas
- trackpad and wheel-based navigation across the canvas
- cursor-centered zoom with the mouse wheel
- visual theme switching
- grid movement through background offset changes

The visual board is simulated by shifting layered CSS backgrounds based on the current camera offset.

## Extension Strategy

The project should evolve in controlled layers:

1. Preserve smooth navigation and visual clarity.
2. Add simple board objects only when the base movement feels solid.
3. Introduce persistence after the object model is clear.
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
