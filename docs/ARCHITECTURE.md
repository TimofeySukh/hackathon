# Architecture

## Current Boundaries

The repository currently has a single-screen frontend prototype architecture.

Runtime boundaries:

- React owns the visible graph prototype state and rendering.
- Vite owns local development and production bundling.
- CSS owns the visual board surface, graph styling, panel styling, and responsive layout.
- The browser owns in-memory graph state for the current session.
- Supabase owns Google authentication and user-owned graph records.
- Supabase Edge Functions own server-side AI provider calls for AI note enrichment and people search.
- Gemini owns the primary LLM execution path for structured summary generation and natural-language people search ranking.
- OpenRouter owns the fallback LLM execution path when Gemini quota or availability errors occur.
- The local MCP server owns agent-facing project documentation resources plus service-role scoped board graph tooling.
- Linear owns task state, status, ownership, priority, and blockers.
- `docs/` owns durable product and repository knowledge.

The visible circle graph demo does not call Supabase or any backend. The existing data layer remains in the repository for persisted product work, but this branch's prototype screen is intentionally local-only.

## Current Frontend Shape

- `src/main.tsx` mounts the React app.
- `src/App.tsx` contains the local circle graph demo, including seed circles, people, pan and zoom camera state, circle-center branch creation, creation menu state, circle movement, and selected-item inspector state.
- `src/lib/supabase.ts` creates the browser Supabase client from Vite environment variables.
- `src/lib/useAuth.ts` owns session loading, Google sign-in, and sign-out.
- `src/lib/useBoardGraph.ts` owns board graph loading, frontend mutation state, and debounced AI note refresh scheduling.
- `src/lib/graphStorage.ts` owns Supabase CRUD for graph data, `person_ai_notes`, and Edge Function invocation.
- `src/lib/userWorkspace.ts` upserts the user profile and ensures a single personal board plus root node.
- `mcp/server.mjs` exposes repo docs as MCP resources and the persisted graph model as MCP tools and dynamic resources.
- `supabase/functions/_shared/ai.ts` calls Gemini first and falls back to OpenRouter for structured AI responses.
- `supabase/functions/sync-person-ai-note/index.ts` authenticates the caller, loads person context, calls the shared AI provider layer, and upserts `person_ai_notes`.
- `supabase/functions/search-people-ai/index.ts` authenticates the caller, builds candidate context, calls the shared AI provider layer, and returns ranked people.
- `src/index.css` contains the visible circle graph prototype styling, including the grid board, dashed circle boundaries, node controls, creation menu, toolbar, and inspector.

The board is rendered with React DOM elements for nodes and dashed circle boundaries, plus SVG paths for curved links. The local camera transforms a world layer for pan and zoom.

## Current Product Boundaries

The current branch is a navigable circle graph prototype, not a production persistence flow.

Current scope:

- central `You` circle
- connected external circles
- nested subset circles inside parent circles
- people inside circles and subsets
- branch creation by dragging from a circle-center plus handle
- a create menu for adding a person, nested subset circle, or connected external circle
- circle and person selection
- local renaming in the inspector
- moving non-root circle centers
- mouse drag navigation on empty space
- cursor-centered mouse-wheel zoom
- local browser-session state only

Out of scope for the current version:

- database persistence
- authentication
- Supabase writes
- LinkedIn import
- notes and AI search
- multiplayer collaboration

## Invariants

- English only for documentation and user-facing text.
- Keep repository knowledge in `docs/`.
- Keep `AGENTS.md` as a short table of contents.
- Keep task status, ownership, and priority in Linear.
- Link implementation work back to the relevant Linear issue.
- Preserve the clean-board product principle from `docs/product-vision.md`.
- Keep all graph rows user-owned and protected by RLS keyed to `auth.uid()`.
- Keep unsigned local graph data out of Supabase until the user signs in and an explicit migration path exists.
- Keep Gemini and OpenRouter API keys out of the browser and only inside Supabase Edge Function secrets.
- Keep `SUPABASE_SERVICE_ROLE_KEY` out of browser-exposed `VITE_` variables and only in local MCP env files or shell env.
- Keep the root person immutable in position and deletion semantics.
- Keep Google OAuth redirect/origin configuration aligned with the real deployed frontend origins.

## When The Repo Grows

- Describe top-level modules and ownership here.
- Record data boundaries, runtime assumptions, and integration points.
- Add any enforced conventions that future contributors should preserve.
- Move reusable UI into `src/components/` when `App.tsx` becomes too broad.
- Move product-specific behavior into `src/features/` once there is more than the board shell.
- Move shared helpers into `src/lib/` only when duplication or complexity justifies it.
