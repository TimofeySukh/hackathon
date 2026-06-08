# Architecture

## Current Boundaries

The repository currently has a single-screen frontend architecture.

Runtime boundaries:

- React owns UI chrome state and panel rendering.
- Canvas 2D owns the current visible 10,000-person graph rendering layer.
- Vite owns local development and production bundling.
- CSS owns the visual shell, chrome tokens, and responsive layout.
- The browser owns generated prototype graph state for the visible screen.
- Supabase owns Google authentication and user-owned graph records.
- Supabase Edge Functions own server-side AI provider calls for AI note enrichment and people search.
- Flutter owns the new `mobile/` client scaffold and generated mobile/web platform runners.
- Gemini owns the primary LLM execution path for structured summary generation and natural-language people search ranking.
- OpenRouter owns the fallback LLM execution path when Gemini quota or availability errors occur.
- The local MCP server owns agent-facing project documentation resources plus service-role scoped board graph tooling.
- Linear owns task state, status, ownership, priority, and blockers.
- `docs/` owns durable product and repository knowledge.

The backend boundary remains intentionally narrow: Supabase Auth provides identity, Supabase Postgres stores one private board plus its graph data for each signed-in user, and Supabase Edge Functions call Gemini/OpenRouter without exposing provider API keys to the browser.

## Current Frontend Shape

- `src/main.tsx` mounts the React app.
- `src/App.tsx` contains the current 10,000-person canvas performance prototype, including deterministic orbit generation, imperative canvas rendering, zoom-based level of detail, cached avatar sprites, root-to-person edge drawing, node dragging, camera refs, spatial hit testing, search, and selected-person panel state.
- `src/lib/supabase.ts` creates the browser Supabase client from Vite environment variables.
- `src/lib/useAuth.ts` owns session loading, Google sign-in, and sign-out.
- `src/lib/useBoardGraph.ts` owns board graph loading, frontend mutation state, and debounced AI note refresh scheduling.
- `src/lib/graphStorage.ts` owns Supabase CRUD for graph data, `person_ai_notes`, and Edge Function invocation.
- `src/lib/userWorkspace.ts` upserts the user profile and ensures a single personal board plus root node.
- `mcp/server.mjs` exposes repo docs as MCP resources and the persisted graph model as MCP tools and dynamic resources.
- `supabase/functions/_shared/ai.ts` calls Gemini first and falls back to OpenRouter for structured AI responses.
- `supabase/functions/sync-person-ai-note/index.ts` authenticates the caller, loads person context, calls the shared AI provider layer, and upserts `person_ai_notes`.
- `supabase/functions/search-people-ai/index.ts` authenticates the caller, builds candidate context, calls the shared AI provider layer, and returns ranked people.
- `src/index.css` contains the current prototype shell, toolbar, stats panel, and selected-person panel styling.
- `mobile/lib/main.dart` contains the generated Flutter starter app. It is scaffolded but not yet wired to the graph model, Supabase, or the current React prototype behavior.

The current visible graph is drawn imperatively on one Canvas 2D layer. React is intentionally kept out of the per-frame point rendering path. Initial render, resize, context restore, visibility restore, and a lightweight watchdog timer can draw directly instead of waiting for `requestAnimationFrame`, so the graph recovers if the browser clears or pauses the canvas backing store.

## Current Product Boundaries

The product is a navigable board foundation, not a whiteboard editor.

Current visible prototype scope:

- generate 10,000 people locally
- place them across many orbit rings around the center
- render visible person points, sampled graph edges, and cached avatar sprites on a single canvas layer
- pan and cursor-centered zoom without React re-rendering each point
- drag individual generated people and rebuild the local spatial index after the drag finishes
- spatially indexed hover and click selection
- local generated-person search
- lightweight React chrome for controls, stats, and selection details

Persisted product capabilities remain in the repository data layer but are not exposed by the current prototype screen.

The Flutter client is currently a separate scaffold. It does not replace the React/Vite prototype and does not share runtime state with it yet.

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
- Keep the root person immutable in position and deletion semantics.
- Keep Google OAuth redirect/origin configuration aligned with the real deployed frontend origins.
- Keep generated Flutter platform code under `mobile/` until there is a deliberate shared-client architecture decision.

## When The Repo Grows

- Describe top-level modules and ownership here.
- Record data boundaries, runtime assumptions, and integration points.
- Add any enforced conventions that future contributors should preserve.
- Move reusable UI into `src/components/` when `App.tsx` becomes too broad.
- Move product-specific behavior into `src/features/` once there is more than the board shell.
- Move shared helpers into `src/lib/` only when duplication or complexity justifies it.
