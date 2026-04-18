# Project Structure

## Root Overview

### `AGENTS.md`

Project workflow rules and documentation update order.

### `README.md`

Top-level project overview, local setup instructions, and links to deeper documentation.

### `docs/`

Detailed project documentation, product direction, and structure notes.

### `index.html`

The main HTML entry point used by Vite.

### `package.json`

Project metadata, scripts, and dependencies.

### `src/`

Application source code.

## Source Structure

### `src/main.tsx`

The React entry point. It mounts the application into the root DOM node.

### `src/App.tsx`

The main app shell. It renders a full-screen `tldraw` editor with local persistence enabled.

### `src/index.css`

Global layout styles for a full-screen canvas app.

## Current Technical Shape

The application is intentionally minimal:

- React for the app shell
- Vite for development and builds
- TypeScript for maintainability
- `tldraw` as the canvas engine and default whiteboard UI

## Extension Strategy

The project should evolve in small layers:

1. Keep the board working and uncluttered.
2. Add product-specific behavior around the board.
3. Introduce custom tools, shapes, or workflows only when needed.
4. Add backend and collaboration features only after the core board experience is solid.

## Future Folders We May Add

### `src/components/`

Reusable UI components outside the core board.

### `src/features/`

Product-specific modules such as sharing, templates, collaboration, or AI tools.

### `src/lib/`

Helpers, utilities, and integration code.

### `src/state/`

Shared app state once the project grows beyond a single board screen.

### `docs/decisions/`

Architecture decision records for major technical and product decisions.
