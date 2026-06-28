# Smart search (natural language)

## Purpose

Let signed-in users find people and circles with natural-language queries such as
"engineers at Google" or "who did I meet at WebConf", using server-side AI to
interpret intent and a local ranker to search the graph hierarchy.

## Behavior

- Anonymous users keep the improved local ranked search only (no LLM calls).
- Signed-in users with natural-language queries get **agent search**: multiple AI passes
  (understand → scan notes → match → optional retry) with visible steps, explanation, and
  suggestion chips.
- The LLM analyze step sets `wantMultiple`: the agent returns many people for group
  requests, uses a group match prompt, expands synonyms/translations, and falls back to
  generic local term matches only when the match worker returns nothing.
- Each person stores a compact `searchSummary` (rebuilt when notes, links, name, or circle
  change). Agent match passes send `summary` instead of full note bodies to save tokens.
- Each AI result can include an `aiReason` citing notes or circle context.
- Local keyword results still appear instantly as a fallback until AI finishes.
- The ranker uses circle paths (company circles, nested subsets), note bodies, Position/Headline
  notes, and link text. Results show `Circle › … · Role` subtitles.
- If AI is unavailable, the server falls back to the same local intent parser.
- CLI: `datanode search:smart "product managers at Meta"`. MCP: `smart_search_people_and_circles`.
- **People discovery** (large graphs, multi-group, map UI): [`people-discovery.md`](people-discovery.md).
  CLI: `datanode search:discover "speakers and investors"`. MCP: `discover_people`.

## Design

- Reuses the board search pill and dropdown from [`board-search.md`](board-search.md).
- New `.search-results__meta` row uses `on-surface-variant` and a subtle divider.

## Code

- Main file(s):
  - [`../../src/lib/search/graphSearch.ts`](../../src/lib/search/graphSearch.ts)
  - [`../../src/lib/smartSearch.ts`](../../src/lib/smartSearch.ts)
  - [`../../src/App.tsx`](../../src/App.tsx)
  - [`../../supabase/functions/graph-api/graphSearch.ts`](../../supabase/functions/graph-api/graphSearch.ts)
  - [`../../supabase/functions/graph-api/interpretSearch.ts`](../../supabase/functions/graph-api/interpretSearch.ts)
  - [`../../supabase/functions/graph-api/index.ts`](../../supabase/functions/graph-api/index.ts)
- Provider: OpenAI only. `graph-api` requires `OPENAI_API_KEY` for signed-in AI search;
  helper and worker calls default to `gpt-5.4-nano`. LLM interpretation failure is
  surfaced as an API error so the UI can label local quick matches as fallback.

## Open questions / TODO

- Optional pgvector semantic rerank for fuzzy note matching.
- Highlight matched substrings in result rows.
