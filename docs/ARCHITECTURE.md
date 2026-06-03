# Architecture

## Current Boundaries

The repository currently has a single-screen frontend architecture.

Runtime boundaries:

- React owns UI state and rendering.
- Vite owns local development and production bundling.
- CSS owns the visual board surface, theme tokens, and responsive layout.
- The browser owns theme persistence through `localStorage`.
- The browser owns unsigned local graph state for users who have not signed in.
- Supabase owns Google authentication and user-owned graph records.
- Supabase Edge Functions own server-side AI provider calls for AI note enrichment and people search.
- `docs/SECURITY.md` owns the security, privacy, data-minimization, and hardening model.
- Gemini owns the primary LLM execution path for structured summary generation and natural-language people search ranking.
- OpenRouter owns the fallback LLM execution path when Gemini quota or availability errors occur.
- The local MCP server owns agent-facing project documentation resources plus service-role scoped board graph tooling.
- Linear owns task state, status, ownership, priority, and blockers.
- `docs/` owns durable product and repository knowledge.

The backend boundary remains intentionally narrow: Supabase Auth provides identity, Supabase Postgres stores one private board plus its graph data for each signed-in user, and Supabase Edge Functions call Gemini/OpenRouter without exposing provider API keys to the browser.

## Current Frontend Shape

- `src/main.tsx` mounts the React app.
- `src/App.tsx` contains the board interaction model, unsigned local graph state, and selected-person inspector.
- `src/App.tsx` also contains the people search overlay with local matching while typing and signed-in AI search on Enter.
- `src/lib/supabase.ts` creates the browser Supabase client from Vite environment variables.
- `src/lib/useAuth.ts` owns session loading, Google sign-in, and sign-out.
- `src/lib/useBoardGraph.ts` owns board graph loading, frontend mutation state, and manual AI note refresh.
- `src/lib/graphStorage.ts` owns Supabase CRUD for graph data, `person_ai_notes`, and Edge Function invocation.
- `src/lib/userWorkspace.ts` upserts the user profile and ensures a single personal board plus root node.
- `mcp/server.mjs` exposes repo docs as MCP resources and the persisted graph model as MCP tools and dynamic resources.
- `supabase/functions/_shared/ai.ts` calls Gemini first and falls back to OpenRouter for structured AI responses.
- `supabase/functions/_shared/cors.ts` restricts browser Edge Function CORS to production, local development, private-LAN Vite origins, and configured allow-list origins.
- `supabase/functions/sync-person-ai-note/index.ts` authenticates the caller, loads sanitized selected-person context, calls the shared AI provider layer, and upserts `person_ai_notes`.
- `supabase/functions/search-people-ai/index.ts` authenticates the caller, builds sanitized context for up to 40 browser-selected candidates, calls the shared AI provider layer, and returns ranked people.
- `supabase/functions/delete-account-data/index.ts` clears the signed-in user's graph rows, AI summaries, profile fields, and root-person identity fields without deleting the Auth user.
- `src/index.css` contains the full visual system.

The board is simulated by shifting layered CSS backgrounds according to a camera offset. The app does not store board objects or draw on a canvas element.

## Current Product Boundaries

The product is a navigable board foundation, not a whiteboard editor.

Current scope:

- mouse drag navigation
- trackpad scroll panning
- cursor-centered mouse-wheel zoom
- two-finger touch pinch zoom with gesture-midpoint anchoring
- dark/light theme switching
- very dense point-grid spatial reference
- Google sign-in through Supabase
- editable unsigned local graph state before sign-in
- one private personal board record per signed-in user
- one immutable root person at `0,0` for each signed-in user
- persistent people nodes with saved coordinates
- one reusable user-owned tag per person
- multiple notes per person
- at most one manually refreshed AI summary record per person with a top-level text summary plus structured JSON fields
- undirected person-to-person connections
- a people search overlay over names, tags, notes, and AI-generated search explanations

Out of scope for the current version:

- drawing tools
- sticky notes or cards
- camera state persistence
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
- Keep AI provider context minimized: no automatic note-triggered summary refresh, no full-graph AI search, and strip email addresses and URLs before provider calls.
- Keep security-sensitive storage, deployment, AI, and authentication decisions reflected in `docs/SECURITY.md`.
- Keep the root person immutable in position and deletion semantics.
- Keep Google OAuth redirect/origin configuration aligned with the real deployed frontend origins.

## When The Repo Grows

- Describe top-level modules and ownership here.
- Record data boundaries, runtime assumptions, and integration points.
- Add any enforced conventions that future contributors should preserve.
- Move reusable UI into `src/components/` when `App.tsx` becomes too broad.
- Move product-specific behavior into `src/features/` once there is more than the board shell.
- Move shared helpers into `src/lib/` only when duplication or complexity justifies it.
