# Hackathon Board

An Obsidian-inspired folder graph viewer built with React, Vite, and TypeScript.

## Current Experience

- A left sidebar with folders that can each open their own graph
- A dedicated `Test Folder` for visual and interaction testing
- Obsidian-like graph styling with compact dots and thin links
- Mouse drag panning across the graph canvas
- Trackpad or wheel panning
- Mouse wheel zoom around the cursor
- Motion-triggered point highlights while moving, panning, or zooming
- Theme switcher in the sidebar
- Optional Google login through Supabase
- One personal board record for each signed-in user
- Dark and light themes using the same visual language
- Point-grid background for spatial reference

## Local Development

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open the local Vite URL in your browser. Fill in the Supabase values in `.env.local` to enable Google login.

## Available Scripts

- `npm run dev` starts the development server.
- `npm run build` creates a production build.
- `npm run preview` previews the production build locally.
- `npm run lint` runs ESLint.

## Product Direction

This version is focused on graph viewing rather than graph editing.

The goal is to make folders feel like separate graph spaces that can be explored visually, starting with realistic demo data and a strong Obsidian-like interaction style.

## Documentation

- Project rules: [AGENTS.md](./AGENTS.md)
- Product direction: [docs/product-vision.md](./docs/product-vision.md)
- Project structure: [docs/project-structure.md](./docs/project-structure.md)
