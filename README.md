# Hackathon Board (Social Datanode)

A social circle graph app built with React, Vite, TypeScript, and Supabase.

**Canonical docs:** start at [`docs/AI_CONTEXT.md`](docs/AI_CONTEXT.md) for an accurate,
AI-readable product summary.

## Current Experience

- Hash routes: landing, board (`#board`), developer docs, contact, privacy
- Blank board: central `You` circle only (no preset demo regions)
- Nested circles and people with curved relationship links
- Pan/zoom; edit, select (marquee), and pan tool modes
- Create people/circles via context menu, double-tap, connector drag
- Inspector: name, notes, connections, circle styling, safe circle delete
- Settings: LinkedIn ZIP import, sign-in/out, Agent API keys, graph import/export/clear
- Search: local + signed-in smart search; paste LinkedIn profile URL to import
- Google and email/password auth; Supabase sync when signed in; `localStorage` when anonymous

## Local Development

```bash
git pull --ff-only
npm ci
cp .env.example .env.local
npm run dev
```

Open the local or network Vite URL. Supabase variables are required for auth, synced boards,
and server-side LinkedIn profile enrichment. Without them, signed-out local editing still works.

Recommended local env:

```bash
VITE_SUPABASE_URL=https://lxnrpdeahoglgiocowsh.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_l_x_y5rxdhL8Sd1ZE3QXag_lOCtr_M9
VITE_SUPABASE_ANON_KEY=
```

## Available Scripts

- `npm run dev` — development server (all network interfaces)
- `npm run build` — production build
- `npm run preview` — preview production build
- `npm run lint` — ESLint
- `npm run test:load` — import load checks (see [`docs/RUNBOOK.md`](docs/RUNBOOK.md))

## Documentation

- **AI / onboarding:** [`docs/AI_CONTEXT.md`](docs/AI_CONTEXT.md)
- Agent rules: [`AGENTS.md`](AGENTS.md)
- Product direction: [`docs/product-vision.md`](docs/product-vision.md)
- Structure: [`docs/project-structure.md`](docs/project-structure.md)
- Features: [`docs/features/README.md`](docs/features/README.md)
- Runbook: [`docs/RUNBOOK.md`](docs/RUNBOOK.md)

## Product Direction

Relationship mapping on a clean visual board — not a generic whiteboard. See
[`docs/product-vision.md`](docs/product-vision.md) for principles and intentional limits.
