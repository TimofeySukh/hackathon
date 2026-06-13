# Hackathon Board

A local social circle graph prototype built with React, Vite, and TypeScript.

## Current Experience

- A central `You` circle as the source of the relationship map
- Larger connected circles around the center for groups such as friends, market, and Pandora
- Nested subset circles inside a parent circle, including a product-team subset inside Pandora
- People placed either directly inside a circle or inside a nested subset
- Curved visual links from circle centers to connected circles and people
- Right-click a circle to open the create menu with two actions: add person or add circle
- Double-tap anywhere to create a person at that exact point; it joins a circle only if tapped inside one, otherwise it stays free-floating
- People are endpoints; only circle centers can create new outgoing branches
- Drag people to reposition them inside their owning circle
- Drag any circle center, including `You`, to move that circle and all contained people and subset circles together
- Resize circles by grabbing and dragging the circle edge
- Parent circles automatically expand or shrink back toward their minimum size as contained objects move
- The visible help panel explains the prototype controls on the page
- Select circles or people to inspect and rename them
- Add three demo people to the selected circle from the inspector
- Drag non-root circle centers to reposition circles
- Pan the board by dragging empty space and zoom with the mouse wheel or toolbar
- Local browser-session state only; no backend, database, auth, or Supabase calls are used by this prototype screen

## Local Development

```bash
git pull --ff-only
npm ci
cp .env.example .env.local
npm run dev
```

Open the local or network Vite URL in your browser. This branch's visible prototype runs entirely locally and does not require Supabase values.

If you want the local project MCP server to read and mutate live board data, also create:

```bash
cp .env.mcp.example .env.mcp.local
```

Then fill in a non-browser `HACKATHON_MCP_SUPABASE_SERVICE_ROLE_KEY`. The MCP server also accepts `HACKATHON_MCP_SUPABASE_URL`, but it can fall back to `VITE_SUPABASE_URL` from `.env.local`.

Recommended local env format:

```bash
VITE_SUPABASE_URL=https://lxnrpdeahoglgiocowsh.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_l_x_y5rxdhL8Sd1ZE3QXag_lOCtr_M9
VITE_SUPABASE_ANON_KEY=
```

`VITE_SUPABASE_ANON_KEY` can stay empty when the publishable key is used.

## Teammate Setup

Everything needed for a teammate is already in the repository:

- application code
- the Supabase migration
- `.env.example`
- `.env.mcp.example`
- project documentation
- project-scoped Supabase MCP skills

The Google OAuth client secret is not needed in the app. It stays in the Supabase Dashboard.

Teammates only need to:

1. Pull the latest `main` and install dependencies with `npm ci`.
2. Create `.env.local` from `.env.example`.
3. Fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
4. Run `npm run dev`.
5. Open the local Vite URL shown in the terminal, or the network URL from another device on the same LAN.
6. Optional for MCP data tools: create `.env.mcp.local` from `.env.mcp.example` and add the service-role key.

If Vite starts on a different local port such as `5173`, `5174`, or `5175`, or the app is opened through a LAN IP such as `http://10.29.0.117:5173`, that exact origin must be added to the Supabase Auth redirect allow list and to Google Cloud Authorized JavaScript origins.
For multi-device login, deploy the frontend on one stable server origin and add that exact origin to both configurations.

## Available Scripts

- `npm run dev` starts the development server on all local network interfaces.
- `npm run build` creates a production build.
- `npm run preview` previews the production build on all local network interfaces.
- `npm run lint` runs ESLint.
- `npm run mcp:start` starts the local Hackathon board MCP server over stdio.

## Product Direction

This version is intentionally focused on social graph building rather than generic whiteboarding.

The goal is to make relationship mapping feel clean, compact, and pleasant to grow directly from each node.

## Documentation

- Project rules: [AGENTS.md](./AGENTS.md)
- Known problems: [docs/PROBLEMS.md](./docs/PROBLEMS.md)
- Product direction: [docs/product-vision.md](./docs/product-vision.md)
- Project structure: [docs/project-structure.md](./docs/project-structure.md)
