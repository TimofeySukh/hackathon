# Hackathon Board

A minimal social graph board built with React, Vite, and TypeScript.

## Current Experience

- A single central node as the starting point of the graph
- Desktop: create a new node by dragging a connection out from any existing node
- Desktop: drop on another existing node to connect the two nodes directly
- Mobile: select a node, switch to `Add relation`, and tap empty space to create a connected node
- Curved directional arrows between connected nodes
- New nodes appear immediately with an empty inline name field
- Mobile-friendly oversized nodes with external labels and drag handles
- Long-press a node on mobile to rename it, add a note, set a tag, or delete it
- Desktop: selected nodes open a detail card with a square color palette, multi-note stack, and delete action
- `Ctrl/Cmd+Z` restores recent graph actions such as delete, recolor, connect, and create
- Infinite canvas-style navigation by dragging with the mouse
- Infinite canvas-style navigation by one-finger pan on mobile
- Infinite canvas-style navigation by scrolling on a trackpad or mouse wheel
- Zoom in and out with the mouse wheel or two-finger pinch on mobile
- No drawing tools or side panels
- Theme switcher in the top-right corner
- Optional Google login through Supabase
- One personal board record for each signed-in user
- Persisted nodes, edges, positions, notes, and tags for signed-in users
- Dark green-black theme inspired by the provided reference
- Light theme designed to match the same visual language
- High-contrast point grid across the board

## Local Development

```bash
git pull --ff-only
npm ci
cp .env.example .env.local
npm run dev
```

Open the local Vite URL in your browser. Fill in the Supabase values in `.env.local` to enable Google login.

Recommended local env format:

```bash
VITE_SUPABASE_URL=https://lycfoukfoesobeuumuad.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_l_x_y5rxdhL8Sd1ZE3QXag_lOCtr_M9
VITE_SUPABASE_ANON_KEY=
```

`VITE_SUPABASE_ANON_KEY` can stay empty when the publishable key is used.

## Teammate Setup

Everything needed for a teammate is already in the repository:

- application code
- the Supabase migration
- `.env.example`
- project documentation
- project-scoped Supabase MCP skills

The Google OAuth client secret is not needed in the app. It stays in the Supabase Dashboard.

Teammates only need to:

1. Pull the latest `main` and install dependencies with `npm ci`.
2. Create `.env.local` from `.env.example`.
3. Fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
4. Run `npm run dev`.
5. Open the local Vite URL shown in the terminal.

If Vite starts on a different local port such as `5173`, `5174`, or `5175`, that origin must be added to the Supabase Auth redirect allow list and to Google Cloud Authorized JavaScript origins.

## Available Scripts

- `npm run dev` starts the development server.
- `npm run build` creates a production build.
- `npm run preview` previews the production build locally.
- `npm run lint` runs ESLint.
- `npm run test:e2e` runs the Playwright mobile smoke test.

## Product Direction

This version is intentionally focused on social graph building rather than generic whiteboarding.

The goal is to make relationship mapping feel clean, compact, and pleasant to grow directly from each node.

## Documentation

- Project rules: [AGENTS.md](./AGENTS.md)
- Product direction: [docs/product-vision.md](./docs/product-vision.md)
- Project structure: [docs/project-structure.md](./docs/project-structure.md)
