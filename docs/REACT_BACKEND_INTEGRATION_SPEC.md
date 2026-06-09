# React Prototype → Backend Integration Spec

> **Audience:** an autonomous agent with **zero prior context** and access to **this Git repository only**.
> Everything you need is in this branch. Read this whole document before writing code.

---

## 0. TL;DR of the goal

This branch contains a **new, visually polished React prototype** in [`src/App.tsx`](../src/App.tsx)
(~1600 lines) that runs **entirely in local component state** — nothing is persisted.

The same branch *also* contains a **complete, already-working Supabase backend integration
layer** under [`src/lib/`](../src/lib/) (auth, CRUD, AI notes, search) plus the SQL migrations
under [`supabase/migrations/`](../supabase/migrations/). The new `App.tsx` simply does **not import any of it**.

Your job: **wire the new prototype to the existing backend**, extend the schema where the
prototype's data model has no home (the "circles" concept), add the missing user-facing
features (auth gate, deletion, real notes), hide developer-only UI, and make a few specific
behavioural fixes listed in §5.

Do **not** resurrect or "finish" the old UI. The old 4331-line `App.tsx` lives on `main`; it is
**not** what we are shipping. This branch's `App.tsx` is the source of truth for the UI.

---

## 1. Current state — what already exists

### 1.1 The new prototype UI — `src/App.tsx` (the thing we keep)
- Self-contained: imports only `react`. All state is local `useState`; refresh loses everything.
- Concepts:
  - **CircleNode** — a *container/group*. Nestable via `parentId`, linked via `connectedTo`,
    has `x,y,radius,minRadius,tone,shapeType('circle'|'wavy'|'polygon'),sides,amplitude,imageUrl`.
  - **PersonNode** — lives *inside* a circle via `circleId`. Has
    `name,role,x,y,avatar,shapeType,sides,amplitude,imageUrl`.
  - **Stress test** — `generateStressPeople(count)` + `drawStressCanvas` render up to 10k
    synthetic icons on a canvas. **Developer-only.**
  - Pan/zoom, drag, resize, right-click create menu, shift-drag to branch, an inspector panel.

### 1.2 The backend layer — `src/lib/` (already written, reuse as-is)
- [`supabase.ts`](../src/lib/supabase.ts) — client; `isSupabaseConfigured` flag; `supabase` is `null` when env is absent.
- [`useAuth.ts`](../src/lib/useAuth.ts) — Google OAuth, session, `signInWithGoogle`, `signOut`, status `loading|anonymous|authenticated|unconfigured`.
- [`useBoardGraph.ts`](../src/lib/useBoardGraph.ts) — the integration hook. Takes `user`, loads the board, exposes
  `createPerson/updatePerson/movePerson/deletePerson`, `createConnection/deleteConnection`,
  `createTag/updateTag/deleteTag`, `createNote/updateNote/deleteNote`, plus debounced
  per-person AI-note sync. **This is your primary tool — extend it, don't rewrite it.**
- [`graphStorage.ts`](../src/lib/graphStorage.ts) — the actual Supabase queries + edge-function calls
  (`sync-person-ai-note`, `search-people-ai` via `searchPeopleWithAi`).
- [`graphTypes.ts`](../src/lib/graphTypes.ts) — DB row types.
- [`tagPalette.ts`](../src/lib/tagPalette.ts), [`userWorkspace.ts`](../src/lib/userWorkspace.ts) — defaults + per-user board bootstrap.

### 1.3 Database schema — `supabase/migrations/`
Key tables (see [`20260418180500_create_graph_persistence.sql`](../supabase/migrations/20260418180500_create_graph_persistence.sql)):
- `boards` — one per user (auto-created by `ensureUserWorkspace`).
- `people` — `id, board_id, owner_user_id, name, tag_id, x, y, is_root`. **Flat. No grouping.**
  Constraints to respect: **one `is_root` person per board**, root is pinned at `(0,0)` and
  **cannot be deleted** (DB trigger enforces this).
- `tags` — flat colored labels (`name, color`), per user.
- `connections` — **person ↔ person** only, canonicalized pair, unique per board.
- `notes` — per person: `title, body`.
- `person_ai_notes` — per person AI summary (`status, summary, structured_summary`).
- RLS is enabled; all access is scoped to the authenticated user. Triggers validate ownership.

---

## 2. THE CORE GAP — data model mismatch (read carefully)

The prototype is organized around **nested circles (groups)**. The backend has **no concept of a
circle/group/container**, and `people` lack most of the prototype's fields.

| Prototype needs | Backend today |
| --- | --- |
| `circles` with `parentId` (nesting) + `connectedTo` (circle↔circle links) | ❌ no table |
| person fields: `circleId, role, avatar, shapeType, sides, amplitude, imageUrl` | only `name, x, y, tag_id, is_root` |
| circle fields: `radius, tone, shapeType, sides, amplitude, imageUrl` | ❌ nowhere |

**Chosen direction: Variant B — extend the schema.** (The product owner picked this over mapping
circles onto flat tags.) Do this as **new additive migrations**; do not break existing tables/columns,
and do not touch the `main` UI.

### 2.1 Schema work (write a new migration under `supabase/migrations/`)
Create a `circles` table, roughly:
```
circles(
  id uuid pk,
  board_id uuid → boards on delete cascade,
  owner_user_id uuid → auth.users on delete cascade,
  name text, icon text,
  x double precision, y double precision,
  radius double precision, min_radius double precision,
  parent_id uuid null → circles(id) on delete cascade,   -- nesting
  connected_to uuid null → circles(id) on delete set null, -- circle↔circle link
  tone text, shape_type text, sides int, amplitude double precision,
  image_url text null,
  is_root boolean default false,                           -- the "You" circle
  created_at, updated_at
)
```
Add to `people` (nullable, additive):
```
circle_id uuid null → circles(id) on delete set null,
role text default '',
avatar text default '',
shape_type text, sides int, amplitude double precision,
image_url text null
```
Mirror the existing tables' **RLS policies, ownership-validation triggers, and `set_updated_at`
triggers** for the new `circles` table and new columns. Follow the patterns already in
[`20260418180500_create_graph_persistence.sql`](../supabase/migrations/20260418180500_create_graph_persistence.sql) — match its style exactly.

> The prototype's "You" circle (`id: 'you'`) maps to the board's root. Reconcile with the existing
> `people.is_root` rule: keep a single root anchor and treat `circles.is_root` as the visual root group.
> Document whatever reconciliation you choose at the top of the migration.

### 2.2 Backend layer work (`graphStorage.ts` + `useBoardGraph.ts` + `graphTypes.ts`)
- Add `Circle` row type and the new person columns to `graphTypes.ts`.
- Add `loadBoardGraph` reading of `circles`; add `createCircle/updateCircle/moveCircle/deleteCircle`
  to `graphStorage.ts`, and expose them through `useBoardGraph.ts` with the same optimistic-update
  pattern already used for people.
- Extend `createPerson/updatePerson` to carry the new fields (`circle_id, role, avatar, shape_type,…`).

---

## 3. UI rewiring — `src/App.tsx`

1. **Auth gate.** Wrap the app in `useAuth()`. If `status === 'authenticated'`, render the board;
   otherwise show a Google sign-in screen (`signInWithGoogle`) and a sign-out control once in.
   If `status === 'unconfigured'` (no env), fall back to the current local-only mode so the
   prototype still runs without Supabase. (The old `main` `App.tsx` already demonstrates this
   `isRemoteGraphReady` + local-fallback pattern — read it for reference, do not copy its UI.)
2. **Replace local state with the hook.** Source `circles`/`people` from
   `useBoardGraph(session?.user ?? null)` instead of local `useState`. Keep a thin client-side
   mapping between the UI shapes and the DB row shapes.
3. **Persist every mutation** through the hook:
   - create person/circle → `createPerson`/`createCircle`
   - drag → `movePerson`/`moveCircle` (**debounce**; don't write on every animation frame)
   - rename/restyle → `updatePerson`/`updateCircle`
   - shift-drag branch → `createConnection`
4. **Deletion (currently missing entirely).** Add delete affordances in the inspector / context
   menu → `deletePerson`, `deleteCircle`, `deleteConnection`, `deleteTag`. Respect the
   "root cannot be deleted" rule.
5. **Real notes (currently missing entirely).** Add a notes section to the person inspector:
   list / create / edit / delete → `createNote`/`updateNote`/`deleteNote`. Optionally surface the
   AI note + `searchPeopleWithAi` (both already wired in the backend layer).

---

## 4. Hide developer-only UI

These are dev/diagnostic tools and must not ship in the user-facing build:
- The **"Icon stress" panel** and its canvas (`stress`, `stressCanvasRef`, `generateStressPeople`,
  `drawStressCanvas`, `MAX_STRESS_ICONS`, synthetic people). Keep the code but gate it behind a dev
  flag (e.g. `import.meta.env.DEV` or a query param) — see §5.3 for the one exception.
- `resetDemo`, hard-coded demo seed data, and the verbose help panel: remove from the default view
  or move behind the same dev flag.

---

## 5. Specific behavioural fixes (explicit product requests)

### 5.1 Move shape settings into their own menu
Today the **Shape Type / Sides / Amplitude / Image URL / Upload** controls are inline in the
inspector for both circles and people ([`src/App.tsx`](../src/App.tsx) ~lines 1077–1200) and take up too
much vertical space. Extract them into a **separate menu/popover** (e.g. a "Shape" button that opens
a panel), reused for both circle and person selections. The inspector should stay compact by default.

### 5.2 Newly spawned people: default to wavy + amplitude 1
`createPerson()` ([`src/App.tsx`](../src/App.tsx) ~line 587) currently spawns people with
`shapeType: 'polygon'`, `amplitude: 2`. Change the default for **newly created people** to
`shapeType: 'wavy'` and `amplitude: 1`. (Apply the same default anywhere people are spawned by the
user.)

### 5.3 "Add 3 demo people" must match the stress-test people
`addDemoCluster()` ([`src/App.tsx`](../src/App.tsx) ~line 654, the "Add 3 demo people" button) currently
produces polygon-styled people that look **different** from the stress-test people produced by
`generateStressPeople()` (~line 1383). Unify them: the demo-added people should be generated in the
**same style/shape as the stress-test icons** so dev load-testing and the demo button stay
consistent.
- **Reference implementation:** the Flutter app already does this ("real people used for load
  testing"). See [`flutter_board/lib/main.dart`](../flutter_board/lib/main.dart) and commit
  `1d141c8` *"Use real people for Flutter load testing"*. Mirror that behaviour in React.

---

## 6. Environment & verification

Setup (per [`README.md`](../README.md)):
```bash
npm ci
cp .env.example .env.local   # fill VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY
npm run dev
```
- Google OAuth requires the dev origin to be in the Supabase Auth redirect allow-list and Google
  Cloud authorized origins. If you cannot obtain credentials, develop against the `unconfigured`
  local-fallback path (§3.1) and ensure the authenticated path compiles and type-checks.
- Apply the new migration to a Supabase project (or `supabase db reset` locally) before testing the
  authenticated path.

**Definition of done**
- [ ] `npm run build` and `npm run lint` pass.
- [ ] New migration applies cleanly with RLS + ownership triggers for `circles` and new columns.
- [ ] Authenticated user: circles, people, connections, notes, tags persist across reload.
- [ ] Deletion works for person/circle/connection/tag (root protected).
- [ ] Notes CRUD works in the person inspector.
- [ ] Shape settings live in a separate compact menu (§5.1).
- [ ] New people default to wavy + amplitude 1 (§5.2).
- [ ] "Add 3 demo people" produces stress-test-style people (§5.3).
- [ ] Stress panel / demo-reset / dev help are hidden from the default user-facing view (§4).
- [ ] App still runs in local-only mode when Supabase env is absent.

---

## 7. Map of files you will touch

| File | Why |
| --- | --- |
| `supabase/migrations/<new>.sql` | Variant B schema: `circles` table + new `people` columns + RLS/triggers (§2.1) |
| `src/lib/graphTypes.ts` | `Circle` type + new person fields (§2.2) |
| `src/lib/graphStorage.ts` | circle CRUD + load + extended person create/update (§2.2) |
| `src/lib/useBoardGraph.ts` | expose circle CRUD; carry new fields (§2.2) |
| `src/App.tsx` | auth gate, hook wiring, deletion, notes, hide dev UI, §5 fixes (§3–§5) |
| `src/lib/useAuth.ts`, `src/lib/supabase.ts` | reuse as-is (reference only) |
| `flutter_board/lib/main.dart` | **read-only reference** for §5.3 |
