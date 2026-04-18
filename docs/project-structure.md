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

Contains the full graph viewer behavior:

- theme state
- active folder state
- graph dataset definitions
- board pan state
- board zoom state
- sidebar folder switching
- graph rendering for nodes and links

### `src/index.css`

Contains the full visual system for:

- sidebar layout
- dark and light themes
- point-grid background
- compact graph node styling
- edge styling
- responsive layout behavior

## Current Technical Shape

The application is intentionally minimal:

- React for state and rendering
- Vite for development and builds
- TypeScript for maintainability
- Custom CSS and SVG rendering for the graph view

## Interaction Model

The application currently supports:

- opening a folder from the left sidebar
- rendering that folder as a graph
- panning across the graph canvas
- zooming around the cursor
- switching between dark and light themes

The graph content is rendered in a transformed world layer, while the background grid tracks the camera position independently.

## Current Data Model

Folders are currently demo datasets defined directly in `src/App.tsx`.

Each folder contains:

- a unique folder id
- a name
- a short description
- a list of nodes with coordinates
- a list of edges

The `Test Folder` is the primary demo dataset for visual testing.

## Extension Strategy

The project should evolve in controlled layers:

1. Preserve visual clarity and smooth navigation.
2. Add richer graph interactions around the existing folder datasets.
3. Replace demo datasets with real folder ingestion later.
4. Add search, filtering, and previews only when the base graph experience feels solid.

## Future Folders We May Add

### `src/components/`

Reusable UI pieces such as sidebar modules, graph overlays, and controls.

### `src/features/`

Product-specific features such as search, filters, note previews, or filesystem integration.

### `src/lib/`

Helpers, utilities, and shared low-level logic.

### `src/state/`

Centralized application and graph state once the product grows beyond a single-screen prototype.

### `docs/decisions/`

Architecture decision records for important product and engineering choices.
