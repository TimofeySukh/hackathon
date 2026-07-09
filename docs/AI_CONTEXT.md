# AI Context — Social Datanode

**Read this file first.** It is the canonical, code-aligned summary for humans and AI agents.
When other docs disagree with this file or with the code, trust the code and update the
conflicting doc.

Last verified against the repository: 2026-07-02.

---

## Product in one paragraph

**Social Datanode** is a single-page web app for building a private visual map of people,
relationships, notes, and links. The main surface is an infinite **board** with a central
`You` circle, nested **circles** (groups/companies/regions), and **people** placed inside
circles. Users pan/zoom the canvas, create nodes by gesture, inspect selection in a side
panel, import LinkedIn archives, and optionally sign in so the graph syncs through Supabase.
Remote **agents** (CLI / MCP) can read and write the same graph through a revision-checked
**graph API** using revocable tokens.

---

## Routes (hash router)

| Hash | Screen | Component |
|------|--------|-----------|
| *(empty)* / `#` | Landing (marketing) | `LandingPage.tsx` |
| `#board` | Interactive board | `App.tsx` board shell |
| `#docs` / `#docs/...` | Developer docs (API/CLI/MCP) | `DocsPage.tsx` |
| `#contact` | Team contact | `ContactPage.tsx` |

Rules:

- Signed-in users are **not** auto-redirected away from landing/docs/contact.
- Auth callbacks land on the clean origin (no hash). A stored return marker opens `#board`
  after the session restores.
- Logo on the landing page returns home; **Open board** is the primary CTA to `#board`.
- The board shows a compact logo control in the top-left that returns to the landing home (`#`).
- The top-left brand on docs and contact also returns to the landing home (`#`).
  Docs no longer uses a separate Back button.

---

## Board data model (`GraphState`)

Stored as one JSON blob per signed-in user in `user_graphs.graph` (Postgres JSONB).

```ts
{
  circles: CircleNode[]   // includes root id 'you'
  people: PersonNode[]
  connections: Connection[]  // person↔person and circle↔circle authored links
}
```

Important fields:

- **CircleNode**: `id`, `name`, `label` (center icon text), `x`, `y`, `radius`, `parentId`,
  `connectedTo`, tone/color/shape fields (`shapeType`, `sides`, `amplitude`, `shapeCustom`, …).
- **PersonNode**: `id`, `name`, `x`, `y`, `circleId` (empty string = free-floating),
  `notes[]`, `connections[]` (typed links), `avatarUrl`, `favorite`, shape fields.
- **No hidden `role` field** — headlines from LinkedIn import become notes titled
  `Headline` / `Profile`.

Fresh graph: **one** `You` circle at the center. There is **no demo seed** (no preloaded EU,
Denmark, Pandora, etc.).

---

## Persistence

| Session | Storage | Path |
|---------|---------|------|
| Anonymous | `localStorage` | Browser-only graph JSON |
| Signed-in | Supabase `user_graphs` | Revision-checked writes |

Signed-in save path:

1. Primary: `graph-api` Edge Function (optimistic concurrency via `revision`).
2. Fallback: direct PostgREST RLS write when the function fails with a non-conflict error.
3. Realtime: Supabase Realtime on `user_graphs` syncs external edits (other tabs, CLI, MCP).

Safety invariants:

- Never autosave a blank fresh graph over missing server data on load.
- Stale writers get `409 Conflict` and must reload.
- Agent tokens are hashed at rest; callers never pass `user_id`.

---

## Board interaction (current)

**Tool modes** (top-left vertical menu):

- Visible only on touch/mobile layouts.
- **Edit** — default: drag nodes, create, connect, resize.
- **Select** — marquee multi-select.
- **Pan** — one-finger/touch drag moves the camera; pinch zoom still works.
- Desktop does not show the mode menu: drag empty space to pan, mouse wheel to zoom,
  trackpad scroll to pan, trackpad pinch to zoom, right-drag to marquee select, and
  right-click a circle to open create actions.

**Onboarding**:

- First board visit opens a short guide on a temporary demo graph matching the landing
  screenshot: `You` plus OpenAI, Anthropic, and Google circles with named people, role
  notes, and profile connections. The real saved/local graph is restored when onboarding
  ends.
- The guide explains pan/zoom, creating a person by double-click/double-tap, creating a
  circle from a center drag, moving/resizing, area selection, Search-based demo person
  lookup, Search-based LinkedIn profile import, Settings, and the LinkedIn archive sync
  guide.
- Guide steps show a blue completed state with a checkmark for one second after the
  matching action is performed, then auto-advance; the visible button skips a step
  manually.
- Landing page board CTAs force-open the guide for that launch.
- For signed-out/local users, the board toolbar Help button reopens the guide. Signed-in
  users do not see this toolbar Help button.
- Mobile guide copy explicitly explains Edit / Select / Pan modes.
- During the Search demo step, opening empty Search shows built-in demo people from the
  temporary graph. The next step teaches LinkedIn profile link import with Timofey Sukhov
  and Velizar Seleznev examples.
- Completing or dismissing the guide shows a success notice and removes the temporary
  demo data.

**Create**:

- Right-click a circle → create menu (add person / add circle).
- Double-tap empty space → person at tap point (joins circle only if inside one).
- Drag from circle center → connection or create menu on empty space.

**Delete**:

- People and connections: Backspace/Delete.
- Circles: **only** via inspector **Delete circle** + confirmation (not keyboard).

**Other**:

- Undo: Ctrl/Cmd+Z (structural actions only; in-memory, lost on reload).
- Settings (gear): LinkedIn ZIP import, account sign-in/out, Agent API keys, graph
  import/export/clear.
- Search (toolbar): local ranked search; signed-in natural-language **smart search** via AI;
  paste LinkedIn profile URL to import one person.
- LinkedIn ZIP import reads `Connections.csv`, groups people by company, and, when present,
  uses non-LLM Part 1 context files (`Positions.csv`, `Rich_Media.csv`, `Shares.csv`,
  recommendations) to add derived person notes. Event context is attached when a
  connection date is near a LinkedIn post date, even without a large same-day connection
  spike. It caches the uploaded archive in memory for the current tab only. For signed-in
  users, server-side LLM enrichment over messages, invitations, and posts starts
  automatically after import; progress is shown per batch and the app persists only
  returned relationship/event/action notes, not raw export text. Re-importing a larger
  archive limits automatic AI enrichment to new connections plus existing people matched
  by new message, invitation, or post rows from that upload. Starting another ZIP import,
  importing a graph JSON, or clearing the graph cancels any in-flight archive AI
  enrichment so stale context cannot overwrite the newer graph.
- Anonymous users see a red `!` badge on the Settings gear until they open the LinkedIn
  sync guide from the `?` helper inside Settings (not a floating banner).
- The LinkedIn sync guide `?` inside Settings shows the same badge until the user opens
  the guide once (no pulse animation).

**Removed — do not document as current**:

- Demo mode (presentation mode that hid chrome).
- Demo seed graph (EU/Denmark/Russia/Pandora preset regions).
- Settings toggles for demo mode, global circle shape/fill, label visibility, stress-test
  slider, in-page help panel, global theme switch (app uses Material 3 light tokens).
- Floating anonymous "sign in to save" banner (replaced by Settings badge + sign-in block).

---

## Backend (Supabase)

| Edge Function | Purpose |
|---------------|---------|
| `graph-api` | Auth (session or agent token), graph CRUD, search, smart search, operations batch |
| `enrich-linkedin-profile` | Server-side single-profile LinkedIn enrichment (API key in secrets) |
| `enrich-linkedin-archive` | Server-side LinkedIn Part 1 LLM enrichment; returns derived notes only |

Migrations: `supabase/migrations/` — `user_graphs`, RLS, revisions, agent tokens, Realtime.

Local tools (not part of the hosted product):

- `scripts/datanode-cli.mjs` — CLI against graph API.
- `scripts/datanode-mcp.mjs` — stdio MCP server.
- `scripts/linkedin-agent-search.mjs` — read-only local JSONL grep for large exports.

---

## Code map (where logic lives)

| Area | Location |
|------|----------|
| App shell, routing, inspector, settings, persistence wiring | `src/App.tsx` (~7k lines; extraction ongoing) |
| Board engine (geometry, layout, render, hit-test) | `src/lib/board/` |
| Graph load/save, Realtime, revision conflicts | `src/lib/graphPersistence.ts` |
| Auth hook | `src/lib/useAuth.ts` |
| Agent token UI API | `src/lib/agentApi.ts` |
| Local + smart search | `src/lib/search/`, `src/lib/smartSearch.ts` |
| LinkedIn enrichment client | `src/lib/linkedinEnrichment.ts` |
| Landing / docs / contact | `src/LandingPage.tsx`, `DocsPage.tsx`, `ContactPage.tsx` |
| Shared UI components | `src/components/` (`M3Slider`, `SelectionIndicator`, …) |
| Styles (Material 3 tokens) | `src/styles/` via `src/index.css` imports |

Public **developer** documentation (API schemas, MCP setup) lives in `src/DocsPage.tsx` on
the website — separate from this `docs/` product knowledge base.

---

## Documentation map

| Doc | Use when |
|-----|----------|
| **This file** | Need accurate product summary fast |
| [`PROJECT_MAP.md`](PROJECT_MAP.md) | Repo inventory, important files, active work links |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | Boundaries, invariants, integration points |
| [`RUNBOOK.md`](RUNBOOK.md) | Commands, env vars, deploy, verification steps |
| [`product-vision.md`](product-vision.md) | Product principles and intentional scope limits |
| [`project-structure.md`](project-structure.md) | File-by-file structure |
| [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md) | Material 3 tokens and UI recipes |
| [`features/README.md`](features/README.md) | Per-feature behavior and design |
| [`DESIGN_LOG.md`](DESIGN_LOG.md) | Why past decisions were made (append-only) |
| [`AGENT_BEST_PRACTICES.md`](AGENT_BEST_PRACTICES.md) | MCP/API agent rules |

Feature docs to read for specifics:

- Board: [`features/board-canvas.md`](features/board-canvas.md)
- Auth: [`features/auth.md`](features/auth.md)
- Search: [`features/board-search.md`](features/board-search.md), [`features/smart-search.md`](features/smart-search.md)
- Onboarding: [`features/onboarding.md`](features/onboarding.md)
- Agent API: [`features/agent-api.md`](features/agent-api.md)
- Realtime: [`features/realtime-sync.md`](features/realtime-sync.md)
- Landing: [`features/landing-page.md`](features/landing-page.md)

---

## Maintenance rule for agents

When you change behavior, structure, or commands:

1. Update the relevant feature doc under `docs/features/`.
2. Update this file if the change affects the canonical summary.
3. Update `RUNBOOK.md` if commands or verification steps change.
4. Append durable decisions to `DESIGN_LOG.md`.
5. Update `src/DocsPage.tsx` only for **developer-facing** API/CLI/MCP changes.

Do **not** resurrect removed features (demo seed, demo mode, theme toggle) in docs unless
re-implementing them in code.
