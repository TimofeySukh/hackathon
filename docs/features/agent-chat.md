# Agent Chat Mode

## Purpose

Give users a dedicated agent workspace alongside the relationship board. The first
version ships an Open WebUI-inspired chat shell that can later connect to LLM
providers, MCP tools, and board context.

## Behavior

- On the board (`#board`), a top-left **Agent** pill switches to agent mode.
- In agent mode, a top-left **Board** pill switches back to the board.
- Agent mode is a full-screen overlay; the board stays mounted underneath so pan/zoom
  listeners and canvas state survive the switch (do not early-return out of the board tree).
- The last selected workspace mode persists in `localStorage`
  (`datanode.workspaceMode`).
- Agent mode includes:
  - sidebar chat list
  - new chat
  - message composer
  - starter prompt chips
  - live replies through OpenRouter `openrouter/free` when `VITE_OPENROUTER_API_KEY` is set
- model-driven read-only board tools. The model can call `get_board_stats`,
  `search_board_people`, `get_board_people`, and `list_board_circles`; browser code executes
  the call against the mounted `GraphState` and returns compact observations.
- Tool results include exact person `id`, `name`, full `circlePath`, notes, links, scores,
  matched circles, offsets, and next offsets for large groups.
- The agent does not read local `Downloads`, Supabase service keys, MCP, or local LinkedIn
  JSONL files. It searches the live board graph through the browser harness.

## OpenRouter setup

**OpenRouter** — это единый API-шлюз к разным LLM (языковым моделям). **OpenRouter Free**
(`openrouter/free`) — бесплатный роутер: он сам выбирает доступную free-модель под запрос.

Local test env (`.env.local`, gitignored):

```bash
VITE_OPENROUTER_API_KEY=sk-or-v1-...
VITE_OPENROUTER_MODEL=openrouter/free
```

Production build env lives in `~/apps/social-datanode-live-autodeploy/deploy.env` on the
deploy host (`VITE_OPENROUTER_API_KEY`, `VITE_OPENROUTER_MODEL`). Nginx CSP must allow
`https://openrouter.ai` in `connect-src` (see `deploy/social-datanode-live/nginx.conf`).

## Design

Inspired by the board/docs Material 3 shell:

- light `--md-surface*` sidebar and top bar, same as docs navigation
- pill workspace toggle, tonal new-chat button, secondary-container active chat row
- message cards on `--md-surface-container` / `--md-primary-container`
- composer uses the same floating pill pattern as board search

## Code

- Main file: [`AgentPage.tsx`](../../src/AgentPage.tsx)
- Mode toggle: [`WorkspaceModeToggle.tsx`](../../src/components/WorkspaceModeToggle.tsx)
- Persistence helper: [`workspaceMode.ts`](../../src/lib/workspaceMode.ts)
- OpenRouter client: [`openRouterChat.ts`](../../src/lib/openRouterChat.ts)
- Board context builder: [`agentBoardContext.ts`](../../src/lib/agentBoardContext.ts)
- Styles: [`agent.css`](../../src/styles/agent.css)
- App integration: [`App.tsx`](../../src/App.tsx)

## Open questions / TODO

- Move OpenRouter calls behind a Supabase Edge Function so the API key is not in the JS bundle.
- Switch from OpenRouter test key to Claude when ready.
- Pass selected person/search results as extra high-priority context.
- Decide whether agent mode should use its own hash route (`#agent`).
