# Local LinkedIn agent search

## Purpose

Provides a read-only, grep-like local search tool for large LinkedIn compact JSONL
exports. It is intentionally separate from the DataNode API, MCP server, Supabase, and
the authenticated board graph. Agents can call it from a shell to retrieve only the
people relevant to a task, then fit those results into a controlled LLM context budget.

Primary use case: a 3k+ LinkedIn export is too large to paste into a model. The tool
searches `people-for-llm.jsonl`, ranks matches deterministically, and emits compact
profiles under a token budget such as 30k or 50k.

## Behavior

- Input is the compact JSONL generated from LinkedIn exports (`people-for-llm.jsonl`).
- Default data file is the newest
  `~/Downloads/linkedin-graph-export-*/people-for-llm.jsonl`; pass `--data` to pin a
  specific export.
- Output is a structured JSON envelope with exact `id`, `name`, `circlePathText`,
  `notes`, `links`, and `score`.
- Default budget is `30,000` estimated tokens; hard maximum is `50,000`.
- When a result set exceeds the budget or limit, the response includes a `next` command
  with the correct `--offset`.
- Search is transparent: terms are matched as normalized substrings across name, role,
  circle path, notes, id, and links.
- Field filters are supported with `field:value` syntax: `id`, `name`, `circle`, `role`,
  `note`, and `link`.
- Common role synonyms are expanded by default and included in `expandedTerms`; use
  `--no-expand` for literal grep behavior.

## Commands

```bash
npm run --silent linkedin:agent-search -- stats
npm run --silent linkedin:agent-search -- search "founder agile" --budget-tokens 30000
npm run --silent linkedin:agent-search -- search "role:coach circle:Novo" --limit 100
npm run --silent linkedin:agent-search -- search "\"software engineer\"" --format jsonl
```

Pin a specific export:

```bash
npm run --silent linkedin:agent-search -- search "founder" \
  --data /Users/velizard/Downloads/linkedin-graph-export-2026-06-14-basic/people-for-llm.jsonl
```

## Agent contract

Agents should:

1. Call `stats` to confirm the file and rough corpus shape.
2. Call `search` with a 30k token budget for the first pass.
3. Use `--mode all` for narrow searches and `--mode any` for broad group discovery.
4. Follow the returned `next` command when more matches are needed.
5. Pass only returned compact profiles to the LLM, not the full board graph.

## Code

- [`../../scripts/linkedin-agent-search.mjs`](../../scripts/linkedin-agent-search.mjs)
