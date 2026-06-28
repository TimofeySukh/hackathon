# Project Map

## Current State

This repository is a React, Vite, and TypeScript social graph board app. (A Flutter
circle-graph prototype existed earlier and was removed.)

It is a live product, not a local-only prototype:

- a full-window relationship circle graph: a central `You` circle, connected
  circles, nested subset circles, and people inside them
- Canvas 2D rendering with canvas hit testing; React owns chrome, menus, and the
  inspector. The hot canvas path (index, hit-test, draw) lives in
  `src/lib/board/`; `src/App.tsx` is the shell + interaction host
- create menu (person / nested circle / connected circle), double-tap to create,
  direct dragging, right-click marquee multi-select, group dragging, circle
  resize, containment fit, and merge-into-subset
- pan, cursor-centered wheel/pinch zoom, and a simplified far-zoom "zones only" view
- Google and email/password sign-in with per-user graph persistence in Supabase
  (debounced autosave); anonymous editing persisted to `localStorage`. Email registration
  requires only email and password, supports confirmation resend and password reset, and a
  new board starts blank (no demo seed)
- LinkedIn import (Connections.csv ZIP + single-profile enrichment),
  per-person notes/tags/connections, and local board search
- settings controls for demo mode, labels, global circle shape, and fill style

## Active Work

- Linear project: [Hackathon](https://linear.app/velizard/project/hackathon-fc67889adc0d)
- Team: `Velizard`
- Working window: April 18-19, 2026
- Source of truth for tasks, owners, priority, and status: Linear

## Current Linear Tasks

- [VEL-5 Finalize project idea and scope](https://linear.app/velizard/issue/VEL-5/finalize-project-idea-and-scope)
- [VEL-6 Collect service links and admin access](https://linear.app/velizard/issue/VEL-6/collect-service-links-and-admin-access)
- [VEL-7 Define presentation roles](https://linear.app/velizard/issue/VEL-7/define-presentation-roles)
- [VEL-8 Prepare final presentation deck](https://linear.app/velizard/issue/VEL-8/prepare-final-presentation-deck)
- [VEL-9 Break down project tasks](https://linear.app/velizard/issue/VEL-9/break-down-project-tasks)
- [VEL-10 Understand Lovable for the project](https://linear.app/velizard/issue/VEL-10/understand-lovable-for-the-project)
- [VEL-11 Find subscription options](https://linear.app/velizard/issue/VEL-11/find-subscription-options)
- VEL-12 Design the AI enrichment workflow
- VEL-13 Evaluate AI provider setup
- [VEL-14 Set up presentation environment](https://linear.app/velizard/issue/VEL-14/set-up-presentation-environment)
- [VEL-15 Write AGENTS.md instructions](https://linear.app/velizard/issue/VEL-15/write-agentsmd-instructions)
- [VEL-16 Fix all bugs](https://linear.app/velizard/issue/VEL-16/fix-all-bugs)

Completed tasks can remain listed here when they explain repository history. Live ownership, priority, and status still belong in Linear.

## Important Files

- `AGENTS.md`: short entrypoint for agent instructions.
- `.agents/skills/`: project-scoped agent skills, currently Supabase and Supabase Postgres guidance.
- `docs/PROJECT_MAP.md`: where the project structure is recorded.
- `docs/RUNBOOK.md`: how to run or verify the repo.
- `docs/ARCHITECTURE.md`: invariants and boundaries.
- `docs/AGENT_BEST_PRACTICES.md`: local agent/MCP/API/CLI rules derived from
  `agents-best-practices`.
- `docs/product-vision.md`: product direction and scope.
- `docs/project-structure.md`: file-by-file project structure notes.
- `docs/DESIGN_SYSTEM.md`: Material 3 design language, tokens, and component recipes that all UI must follow.
- `docs/features/`: one document per user-facing feature (look and behavior), with a template and index.
- `docs/DESIGN_LOG.md`: append-only log of durable design decisions.
- `README.md`: top-level overview and local development commands.
- `scripts/test-database-load.mjs`: dry-run by default synthetic `user_graphs` payload generator, with guarded staging write/read/cleanup support.
- `scripts/test-ui-import-responsiveness.mjs`: Playwright-driven large LinkedIn ZIP import check that measures browser event-loop lag.
- `scripts/test-ui-import-persistence.mjs`: local Playwright import persistence check with a mock Supabase graph API; verifies ZIP import, graph JSON import, and reload without touching production.
- `scripts/datanode-cli.mjs`: local CLI client for the agent graph API.
- `scripts/datanode-mcp.mjs`: stdio MCP server for AI agents, backed by the graph API.
- `src/main.tsx`: React entry point.
- `src/App.tsx`: React shell + interaction host for the board (chrome, panels, pointer interaction, persisted-graph wiring, paint loop). Delegates canvas logic to `src/lib/board/`.
- `src/lib/board/`: framework-free board engine — `types`, `constants`, `colors`, `geometry`, `layout` (containment/collision), `render` (spatial index, hit-test, Canvas 2D draw layer).
- `src/lib/supabase.ts`: browser Supabase client configuration.
- `src/lib/useAuth.ts`: session, Google sign-in, email/password sign-in, confirmation resend, and password reset state.
- `src/lib/graphPersistence.ts`: load/save the graph blob (Supabase signed-in, `localStorage` anonymous).
- `src/index.css` + `src/styles/`: visual system, split into `@import`ed partials (cascade order = import order).
- `skills-lock.json`: lockfile for installed project agent skills.
- `supabase/migrations/`: database schema and row-level security migrations.
- `supabase/functions/`: server-side Supabase Edge Functions for LinkedIn profile enrichment and the agent graph API.

## Ownership

Task ownership is tracked in Linear. Code ownership is not split by directory yet.

## Next Steps

- Keep the circle graph prototype easy to evaluate while product scope is finalized.
- Link any implementation task or pull request back to the relevant Linear issue.
- Update `docs/product-vision.md` when product scope changes.
- Update `docs/project-structure.md` and `docs/ARCHITECTURE.md` when source structure or boundaries change.
- Follow `docs/DESIGN_SYSTEM.md` for UI work, keep a feature doc under `docs/features/` for each feature, and log durable design decisions in `docs/DESIGN_LOG.md`.
- Keep Supabase Auth redirect URLs and Google OAuth origins aligned with every deployed frontend origin.
- Remember that commits on `main` deploy to the primary production site within about 3 minutes after they reach GitHub.
