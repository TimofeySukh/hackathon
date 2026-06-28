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
- Agent mode is standalone for now:
  - sidebar chat list
  - new chat
  - message composer
  - starter prompt chips
  - live replies through OpenRouter `openrouter/free` when `VITE_OPENROUTER_API_KEY` is set
- A deterministic zero-to-demo second-degree lead-search scenario is available without OpenRouter:
  - when the user asks as a farm sales director selling apples and asks for second-degree
    people who work at stores, the chat returns a prepared sales-intelligence answer
  - the prepared answer fabricates the demo data: 14,892 second-degree profiles scanned,
    1,086 store and retail operators, and 8 priority retail buyers
  - the prepared answer renders as a structured report with metric tiles, a best-path
    callout, a prioritized lead table with LinkedIn, email, mutual connection, company,
    and priority rationale, plus fake email-generation buttons for first-degree intro and
    second-degree direct outreach drafts
  - this path is for video/demo flow only and does not read the board graph, LinkedIn, API,
    CLI, MCP, or OpenRouter
- Board graph state and chat history are not linked yet.

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
- Styles: [`agent.css`](../../src/styles/agent.css)
- App integration: [`App.tsx`](../../src/App.tsx)

## Open questions / TODO

- Move OpenRouter calls behind a Supabase Edge Function so the API key is not in the JS bundle.
- Switch from OpenRouter test key to Claude when ready.
- Connect agent tools to the existing graph API / MCP server.
- Pass board context (selected person, search results) into agent prompts.
- Decide whether agent mode should use its own hash route (`#agent`).
