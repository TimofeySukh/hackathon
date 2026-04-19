# Hackathon Board

A persisted social graph board built with React, Vite, and TypeScript.

## Current Experience

- A single central node as the starting point of the graph
- Create a new node by dragging a connection out from any existing node
- If you drop on another node, the two existing nodes connect directly
- Curved lines between connected nodes
- New nodes appear immediately with an empty inline name field
- Compact obsidian-like nodes with labels
- Infinite canvas-style navigation by dragging with the mouse
- Infinite canvas-style navigation by scrolling on a trackpad
- Cursor-centered zoom in and out with the mouse wheel
- No drawing tools or side panels
- Theme switcher in the top-right corner
- Optional Google login through Supabase
- One personal board record for each signed-in user
- One immutable root node at `0,0` for each signed-in user
- Persistent people, colored tags, notes, and undirected connections in Supabase
- Top-left Tags menu with tag renaming plus preset and custom color picking
- A login popup appears when signed-out users try to edit the board
- Minimal selected-person inspector with a large name field, compact tag picker, and auto-saving notes
- Single-click a person to open that inspector directly on the board
- Opening the inspector pans the board enough to keep it visible and opens it at a consistent size before later zoom changes affect it
- Click the widened connection-line target to delete it from the inline menu or with Backspace
- Drag a person to move them with their connected lines
- Hold `Command` on macOS, or `Control` on other platforms, and drag a person to create a connection
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

Open the local or network Vite URL in your browser. Fill in the Supabase values in `.env.local` to enable Google login.

If you want the local project MCP server to read and mutate live board data, also create:

```bash
cp .env.mcp.example .env.mcp.local
```

Then fill in a non-browser `HACKATHON_MCP_SUPABASE_SERVICE_ROLE_KEY`. The MCP server also accepts `HACKATHON_MCP_SUPABASE_URL`, but it can fall back to `VITE_SUPABASE_URL` from `.env.local`.
For LAN access, `.env.mcp.local` can also define `HACKATHON_MCP_HTTP_HOST`, `HACKATHON_MCP_HTTP_PORT`, and `HACKATHON_MCP_ALLOWED_HOSTS`.

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
7. Optional for LAN MCP access: run `npm run mcp:start:http` and connect other devices to `http://<host-ip>:3334/mcp`.

If Vite starts on a different local port such as `5173`, `5174`, or `5175`, or the app is opened through a LAN IP such as `http://10.29.0.117:5173`, that exact origin must be added to the Supabase Auth redirect allow list and to Google Cloud Authorized JavaScript origins.
For multi-device login, deploy the frontend on one stable server origin and add that exact origin to both configurations.

## Available Scripts

- `npm run dev` starts the development server on all local network interfaces.
- `npm run build` creates a production build.
- `npm run preview` previews the production build on all local network interfaces.
- `npm run lint` runs ESLint.
- `npm run mcp:start` starts the local Hackathon board MCP server over stdio.
- `npm run mcp:start:http` starts the local Hackathon board MCP server over Streamable HTTP for LAN clients.

## Product Direction

This version is intentionally focused on social graph building rather than generic whiteboarding.

The goal is to make relationship mapping feel clean, compact, and pleasant to grow directly from each node.

## Documentation

- Project rules: [AGENTS.md](./AGENTS.md)
- Product direction: [docs/product-vision.md](./docs/product-vision.md)
- Project structure: [docs/project-structure.md](./docs/project-structure.md)
