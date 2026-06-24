# Agent API

## Purpose

Provides safe remote access for AI agents, MCP clients, and CLI tools without exposing
Supabase project secrets or allowing access to another user's graph.

## Behavior

- Signed-in users create and revoke agent tokens from Settings.
- Tokens are shown once, stored server-side only as SHA-256 hashes, and can be revoked.
- Agent tokens identify exactly one user. API requests never accept `user_id` from the
  caller.
- Default agent scopes allow graph/search reads and granular writes for people, notes,
  links, and relationship connections. Full graph replacement requires the separate
  `graph:replace` scope.
- All graph writes require `expectedRevision`. Stale writers receive `409 Conflict`
  instead of overwriting a newer board.
- People have exactly one direct `circleId`. Nested membership is derived from the
  target circle's parent chain.

## Design

- Surfaces / elevation used: the Settings panel's existing Material 3 surface.
- Components used: text field, filled buttons, small list rows, and status text.
- Color roles used: existing Settings panel neutral roles plus danger button styling for
  revoke.
- Anything feature-specific: plaintext tokens appear in a one-time copy area with the
  `DATANODE_API_URL` and `DATANODE_API_TOKEN` environment snippet.
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
  - `datanode:cli` and `datanode:mcp` npm scripts
- Related state / hooks:
  - `agentTokens`, `newAgentToken`, `agentTokensBusy`, `agentTokenStatus`
  - `loadedGraphRevisionRef` for browser-side optimistic concurrency

## Open questions / TODO

- Add a dedicated visual token management screen if the Settings panel gets crowded.
- Add more MCP tools when the product exposes richer circle editing behavior.
