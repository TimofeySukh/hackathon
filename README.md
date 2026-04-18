# Hackathon Board

A minimal social graph board built with React, Vite, and TypeScript.

## Current Experience

- A single central node as the starting point of the graph
- Create a new node by dragging a connection out from any existing node
- Curved directional arrows between connected nodes
- Compact obsidian-like nodes with labels
- Infinite canvas-style navigation by dragging with the mouse
- Infinite canvas-style navigation by scrolling on a trackpad or mouse wheel
- Zoom in and out with the mouse wheel
- No drawing tools or side panels
- Theme switcher in the top-right corner
- Optional Google login through Supabase
- One personal board record for each signed-in user
- Dark green-black theme inspired by the provided reference
- Light theme designed to match the same visual language
- High-contrast point grid across the board

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

This version is intentionally focused on social graph building rather than generic whiteboarding.

The goal is to make relationship mapping feel clean, compact, and pleasant to grow directly from each node.

## Documentation

- Project rules: [AGENTS.md](./AGENTS.md)
- Product direction: [docs/product-vision.md](./docs/product-vision.md)
- Project structure: [docs/project-structure.md](./docs/project-structure.md)
