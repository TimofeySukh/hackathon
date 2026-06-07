# Hackathon Board

A social graph board prototype built with React, Vite, TypeScript, and Canvas 2D.

## Current Experience

- A full-window Canvas 2D graph surface
- 5,000 generated people rendered at once
- Deterministic orbit layout around the center
- Pointer drag panning
- Cursor-centered mouse-wheel zoom
- Toolbar zoom and reset controls
- Local generated-person search
- Click and hover hit testing through a spatial index
- Lightweight React stats and selected-person panels
- No visible Supabase, auth, LinkedIn import, notes, AI search, or tag management UI in the current performance prototype

## Local Development

```bash
git pull --ff-only
npm ci
cp .env.example .env.local
npm run dev
```

Open the local or network Vite URL in your browser. The current visible prototype runs without Supabase variables because it generates its 5,000 people locally.

Fill in the Supabase values in `.env.local` only when working on the persisted data layer, MCP data tools, or future screens that use authentication.

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

This version is intentionally focused on proving that a dense social graph can load and stay interactive before the product UI is rebuilt around persisted data.

The likely product direction is React for application chrome and a dedicated graph renderer for the graph layer.

## Documentation

- Project rules: [AGENTS.md](./AGENTS.md)
- Known problems: [docs/PROBLEMS.md](./docs/PROBLEMS.md)
- Product direction: [docs/product-vision.md](./docs/product-vision.md)
- Project structure: [docs/project-structure.md](./docs/project-structure.md)
