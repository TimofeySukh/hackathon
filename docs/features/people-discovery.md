# People discovery (exoskeleton agent)

## Purpose

Find relevant people across **large graphs** (hundreds–thousands of contacts) using an
[exoskeleton-style](https://github.com/muxx/bitgn-ecom1-exoskeleton) agent: the LLM
**plans** groups and proposes matches; deterministic code **prefilters**, **batches**,
**validates ids**, and **computes layout**.

Use cases:

- Conference speakers with interesting ideas
- People worth reaching out to
- Who can help with a specific task
- **Multi-group** queries in one pass (`speakers and investors`, `кто может помочь с X и Y`)

Results open in a **Discovery map** overlay: groups as dashed rings, people as nodes
clustered by relevance (similar circle/role placed adjacently on each ring).
Clicking a person shows the AI reason plus that person's graph notes and links in the
side panel; **Open on board** still jumps to the full board inspector.

## Behavior

1. **Plan** (LLM): split query into 1–4 groups with `label`, `description`, `searchTerms`.
2. **Prefilter** (code): score every person via `searchSummary` + LLM/user terms; cap
   candidates by graph size (45–120 per group).
3. **Match** (LLM batches): ~22 candidates per call; strict JSON schema on GPT-OSS models.
4. **Fallback** (code): local term hit scoring only when the match worker returns no
   matches after a valid LLM plan. Planner failure is surfaced as an API error; it no
   longer creates a single generic `Matches` circle.
5. **Layout** (code): normalized `x`/`y` for SVG map — multi-group = groups on outer ring,
   people on inner rings; single group = one large ring.

Signed-in users see **Open discovery map** for multi-word queries. MCP/CLI:
`discover_people` / `search:discover`.

## LLM providers

Exoskeleton-style split (see [bitgn-ecom1-exoskeleton](https://github.com/muxx/bitgn-ecom1-exoskeleton)):

| Role | Env | Default | Tasks |
|------|-----|---------|-------|
| Helper (nano) | `SEARCH_HELPER_MODEL` + provider key | `gpt-5.4-nano` on OpenAI, `gpt-oss-20b` on Groq | Plan groups, analyze query, **verify** matches |
| Worker (mini) | `SEARCH_WORKER_MODEL` + provider key | `gpt-5.4-mini` on OpenAI, `gpt-oss-120b` on Groq | Batch **match** candidates |

Deterministic validation (code, not LLM):

- **Weighted prefilter** — role/notes score higher than circle name
- **Strong-tier fallback** — when the match worker returns nothing, high-signal profiles are kept
- **Recall audit** — scan full graph for missed strong matches; union into results
- **Schema/id guards** — LLM matches must use exact candidate ids; invalid ids are rejected

Target: high recall on tagged eval sets:

- Synthetic 300-person graph: `npm run test:agent-search`
- LinkedIn-scale (~3k, Position + Company only):
  `npm run test:agent-search:linkedin -- /path/to/Basic_LinkedInDataExport.zip`
- Large synthetic bench (~3k, hard queries): `npm run test:agent-search:bench`
  Quick smoke: `npm run test:agent-search:bench:quick`

Provider selection:

1. `OPENAI_API_KEY` → helper/worker OpenAI models.
2. `GROQ_API_KEY` → helper `gpt-oss-20b`, worker `gpt-oss-120b`.
3. `AI_SEARCH_API_KEY` → NeuralDeep/OpenAI-compatible base URL.

Responses include `llmProviders` so the UI and API callers can see which provider actually
answered. If only `GROQ_API_KEY` is configured, OpenAI dashboard logs will stay empty.

## Code

- [`../../supabase/functions/graph-api/agentDiscovery.ts`](../../supabase/functions/graph-api/agentDiscovery.ts)
- [`../../supabase/functions/graph-api/llmProvider.ts`](../../supabase/functions/graph-api/llmProvider.ts)
- [`../../src/components/AgentDiscoveryView.tsx`](../../src/components/AgentDiscoveryView.tsx)
- [`../../src/lib/agentDiscovery.ts`](../../src/lib/agentDiscovery.ts)

## API

`POST /v1/search/discover` — body `{ "query": "..." }`.
Optional `perGroupLimit`/`limit` caps each group at 1–24 people; omit it for the automatic
strong-tier cap.

See website docs (`DocsPage`) and [`smart-search.md`](smart-search.md) for related search endpoints.

## Open questions / TODO

- Embedding-based prefilter for semantic recall beyond substring terms.
- Persist last discovery map in session storage.
- Drag-to-reposition nodes on the discovery map.
