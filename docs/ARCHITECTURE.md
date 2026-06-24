# Architecture

## Current Boundaries

The repository currently has a single-screen frontend prototype architecture.

Runtime boundaries:

- React owns the visible graph prototype state and rendering.
- Vite owns local development and production bundling.
- CSS owns the visual board surface, graph styling, panel styling, and responsive layout.
- The browser owns in-memory graph state for the current session.
- Supabase owns Google authentication, email/password authentication, password recovery,
  and user-owned graph records.
- Supabase Edge Functions own server-side LinkedIn profile enrichment calls.
- Linear owns task state, status, ownership, priority, and blockers.
- `docs/` owns durable product and repository knowledge.

The board is a live product, not a local-only demo. Signed-in users load and
autosave their graph through Supabase; anonymous visitors get an editable board
persisted to `localStorage`. The brand-new board starts blank (a single `You`
circle) — there is no demo seed.

## Current Frontend Shape

- `src/main.tsx` mounts the React app.
- `src/App.tsx` is the React shell and interaction host: chrome/panels, pointer
  interaction (pan/zoom, drag, marquee selection, group drag, resize, merge),
  camera + cursor state, the persisted-graph wiring, and the imperative paint
  loop. The heavy canvas logic is delegated to `src/lib/board/`.
- `src/lib/board/` is the framework-free board engine: `types.ts`, `constants.ts`,
  `colors.ts`, `geometry.ts`, `layout.ts` (containment/collision), and
  `render.ts` (spatial index, hit-testing, the Canvas 2D draw layer).
- `src/lib/graphPersistence.ts` loads/saves the graph blob (Supabase for
  signed-in users, `localStorage` for anonymous sessions).
- `src/lib/supabase.ts` creates the browser Supabase client from Vite environment variables.
- `src/lib/useAuth.ts` owns session loading, Google sign-in, email/password sign-in,
  registration, confirmation resend, password recovery, and sign-out.
- `supabase/functions/enrich-linkedin-profile/index.ts` authenticates the caller, calls the configured profile provider for one manually pasted LinkedIn profile URL, and returns normalized profile fields.
- `src/index.css` contains the visible circle graph prototype styling, including the grid board, creation menu, toolbar, and inspector.

The board's hot visual path is rendered on a single Canvas 2D layer: circle fills and labels, center controls, people avatars and labels, curved links, selected handles, hover states, and the draft connector. React still owns the surrounding chrome, menus, inspector, and persisted graph state. Pointer events land on the board surface and use canvas hit testing against a lightweight spatial grid instead of DOM/SVG nodes.

## Current Product Boundaries

Current scope:

- central `You` circle, connected external circles, nested subset circles, and
  people inside circles and subsets
- a create menu for adding a person, nested subset circle, or connected circle
- circle/person selection, plus right-click marquee multi-selection
- dragging people and circles (incl. group dragging of a mixed selection)
- circle resizing, automatic containment fit / shrink-back through nested chains
- merge selected people and zones into a new subset
- pan, cursor-centered wheel/pinch zoom, and a "zones only" far-zoom view
- Google and email/password sign-in; per-user graph persistence in Supabase with
  debounced autosave
- anonymous editing persisted to `localStorage`
- LinkedIn import (Connections.csv ZIP + single-profile enrichment)
- per-person notes, tags, and connections stored inside the graph blob
- local board search

Out of scope (still not built):

- real-time multiplayer / presence
- drawing tools and sticky notes

## Invariants

- English only for documentation and user-facing text.
- Keep repository knowledge in `docs/`.
- Keep `AGENTS.md` as a short table of contents.
- Keep task status, ownership, and priority in Linear.
- Link implementation work back to the relevant Linear issue.
- Preserve the clean-board product principle from `docs/product-vision.md`.
- Keep all graph rows user-owned and protected by RLS keyed to `auth.uid()`.
- Never let a missing graph row silently overwrite a user's server data with a blank
  fresh graph; fallback or fail visibly before autosave.
- Keep unsigned local graph data out of Supabase until the user signs in and an explicit migration path exists.
- Keep LinkedIn enrichment provider API keys out of the browser and only inside Supabase Edge Function secrets.
- Keep the root person immutable in position and deletion semantics.
- Keep Google OAuth and Supabase email redirect/origin configuration aligned with the real deployed frontend origins.

## When The Repo Grows

- Describe top-level modules and ownership here.
- Record data boundaries, runtime assumptions, and integration points.
- Add any enforced conventions that future contributors should preserve.
- Move reusable UI into `src/components/` when `App.tsx` becomes too broad.
- Move product-specific behavior into `src/features/` once there is more than the board shell.
- Move shared helpers into `src/lib/` only when duplication or complexity justifies it.
