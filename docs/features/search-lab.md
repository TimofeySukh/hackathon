# Search Lab (local UI)

## Purpose

Visual sandbox for agent search / discovery on **synthetic data**. Use it to try queries and see how the agent organizes results on the **full board graph** (same canvas as the main app).

## Access

- Dev build only: open board → search icon → **Search Lab — synthetic data, local**
- Or navigate to `#search-lab` (e.g. `http://localhost:5173/#search-lab`)

## Agent engines

| Engine | Requirements | Behavior |
|--------|--------------|----------|
| **LLM agent** (default when signed in) | Sign in + server `OPENAI_API_KEY` | Calls `POST /v1/search/discover-lab` with synthetic graph — OpenAI `gpt-5.4-nano` plans, matches, and verifies. Response includes `llmCalls` and `llmProviders`. |
| **Local harness** | None | Deterministic rules in the browser, no network. |

Deploy or serve the updated `graph-api` edge function so `/v1/search/discover-lab` is available locally.

## Controls

| Control | Effect |
|---------|--------|
| LLM agent / Local harness | Choose engine |
| Small / Large dataset | ~300 vs ~3000 seeded people, ring-packed layout |
| Organize with AI | Discovery circles on the board + grouped matches |
| Show full network | After search, toggle focused results vs full graph |
| Presets | Bench queries from `npm run test:agent-search:bench` |

Result count is **automatic** (strong-tier + audit slack). Steps appear progressively; LLM mode waits for real server round-trip then replays steps.

Large result sets stay in **zone-only zoom** (like the 3000-person board at 0.1×) — discovery circles show counts; zoom in to see individuals. Search matches use a light ring outline, not the favorite halo. **LLM agent** plans group count and labels from the query; local harness uses a single "Matches" group.

## Code

- [`../../src/SearchLabPage.tsx`](../../src/SearchLabPage.tsx)
- [`../../src/lib/agentDiscovery.ts`](../../src/lib/agentDiscovery.ts) — `discoverSyntheticGraph`
- [`../../src/lib/search/runDiscoveryWithProgress.ts`](../../src/lib/search/runDiscoveryWithProgress.ts)
- [`../../supabase/functions/graph-api/agentDiscovery.ts`](../../supabase/functions/graph-api/agentDiscovery.ts)

Production board discovery: `POST /v1/search/discover` (saved graph).
