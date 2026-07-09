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
- Each AI result can include an `aiReason` citing notes or circle context.
- Local keyword results still appear instantly as a fallback until AI finishes.
- The deterministic ranker uses separate exact-name, name-token, role/headline, notes,
  circle-path, link, and coverage arms with RRF-style fusion. Results show
  `Circle › … · Role` subtitles.
- If AI is unavailable, the server falls back to the same local intent parser.
- CLI: `datanode search:smart "product managers at Meta"`. MCP: `smart_search_people_and_circles`.

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
- Provider: [NeuralDeep OpenAI-compatible API](https://neuraldeep.ru/docs), model default
  `qwen3.6-35b-a3b-noreason`.

## Open questions / TODO

- Optional pgvector semantic rerank for fuzzy note matching.
- Highlight matched substrings in result rows.
- Replace the current fixed analyze/match/retry AI pipeline with the visible model/tool
  loop described in [`fast-agentic-search.md`](fast-agentic-search.md).
