# Agent API

## Purpose

Provides safe remote access for AI agents, MCP clients, and CLI tools without exposing
Supabase project secrets or allowing access to another user's graph.

## Behavior

- Signed-in users open Agent API key management from Settings. The key manager is a
  large modal overlay; opening it closes the compact Settings panel.
- The first tab is **Quick setup** for non-technical users: create a key and copy one
  ready-to-paste instruction for an AI agent.
- Sidebar tabs split advanced material into **MCP**, **CLI**, **API**, and **Keys**.
- Revoked keys disappear from the active key list immediately.
- Tokens are shown once, stored server-side only as SHA-256 hashes, and can be revoked.
- Agent tokens identify exactly one user. API requests never accept `user_id` from the
  caller.
- Default agent scopes allow graph/search reads and granular writes for people, notes,
  links, and relationship connections. Full graph replacement requires the separate
  `graph:replace` scope.
- All graph writes require `expectedRevision`. Stale writers receive `409 Conflict`
  instead of overwriting a newer board.
- Agent-facing mutation responses are compact: they return `revision`, graph `counts`,
  and the operation `result`, but not the full graph. Person and circle mutation results
  are reduced to stable references (`person:<id>`, `circle:<id>`) and never include
  image/base64 payloads.
- MCP tool results use a structured JSON envelope with `status`, `summary`, `data`, and
  `next_valid_actions`; tool definitions expose risk metadata and strict argument schemas.
- MCP includes `list_capabilities` for compact risk-aware tool discovery.
- Large graph lookup uses a two-step flow: batch/search tools return compact references,
  then `get_people` / `POST /people/batch` fetch exact profiles for up to 250 requested
  people, preserving id order and omitting unrelated people.
- Large, bulk, experimental, or destructive MCP operations should be preceded by an
  `export_graph` backup or explicit user confirmation.
- People have exactly one direct `circleId`. Nested membership is derived from the
  target circle's parent chain.

## Design

- Surfaces / elevation used: a full-screen overlay with a large Material 3 dialog,
  sidebar, and content surface.
- Components used: sidebar tabs, text fields, copy textareas, filled buttons, small list
  rows, and status text.
- Color roles used: existing Settings panel neutral roles plus danger button styling for
  revoke.
- Anything feature-specific: plaintext tokens appear in a one-time copy area and the
  Quick setup tab generates a full instruction block that can be pasted directly into an
  AI agent.
- Known gaps vs. the Material 3 target: the token list is intentionally compact and can
  be extracted into reusable settings components when the panel grows.

## Code

- Main file(s):
  - `src/App.tsx`
  - `src/lib/agentApi.ts`
  - `supabase/functions/graph-api/index.ts`
  - `supabase/migrations/20260624112536_add_graph_revisions_and_agent_tokens.sql`
  - `scripts/datanode-cli.mjs`
  - `scripts/datanode-mcp.mjs`
- Key functions / components:
  - `listAgentTokens`, `createAgentToken`, `revokeAgentToken`
  - `graph-api` Edge Function token auth and graph mutation handlers
  - `datanode:cli`, `datanode:mcp`, and `operations:run` batch CLI support
  - `search:batch`, `people:get`, `people:batch`, `batch_search_people_and_circles`,
    and `get_people` for large graph agent reads
- Related state / hooks:
  - `agentTokens`, `newAgentToken`, `agentTokensBusy`, `agentTokenStatus`
  - `loadedGraphRevisionRef` for browser-side optimistic concurrency

## Open questions / TODO

- Add a dedicated visual token management screen if the Settings panel gets crowded.
- Add MCP tool search/deferred loading if the DataNode tool surface grows beyond the
  current graph-focused set.
