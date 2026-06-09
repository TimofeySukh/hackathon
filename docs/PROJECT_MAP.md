# Project Map

## Current State

This repository contains a React, Vite, and TypeScript social graph board app.

The current product is intentionally narrow:

- a full-window board surface
- mouse drag navigation
- one-finger touch drag navigation on mobile devices
- a dark/light theme toggle
- a top-left LinkedIn menu with archive-request instructions and minimized `Connections.csv` zip import
- a very dense CSS-rendered point grid
- Supabase-backed Google login
- editable unsigned local board state when the user is not signed in
- onboarding overlay for empty or starter-sized graphs
- one personal board record per signed-in user
- one 10-contact starter sample for new signed-in empty boards
- persistent people nodes, reusable colored tags, notes, and undirected connections per signed-in user
- batched LinkedIn import for people, source notes, and root connections
- canvas overview rendering for large graphs with a capped interactive DOM/SVG overlay
- a top-left Tags menu for creating tags, renaming them, changing tag colors, and toggling tag visibility on the board
- a node-anchored inspector for editing the selected person that opens on single click
- a people search layer that matches locally while typing and can run candidate-limited AI search on Enter when signed in
- account menu graph export, graph deletion, and account-data deletion controls
- no collaboration yet

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
- `docs/PROBLEMS.md`: known open and resolved problems that must stay visible across work sessions.
- `docs/SECURITY.md`: security, privacy, storage, and hardening model.
- `docs/product-vision.md`: product direction and scope.
- `docs/project-structure.md`: file-by-file project structure notes.
- `README.md`: top-level overview and local development commands.
- `.env.mcp.example`: local-only MCP environment template for service-role access.
- `.mcp.json`: project MCP configuration for the local Hackathon board stdio server.
- `fixtures/linkedin/`: generated large LinkedIn import fixtures for performance testing and the 10-contact starter sample archive.
- `mcp/server.mjs`: local MCP server that exposes project docs and board graph tooling.
- `scripts/generate-linkedin-connections.mjs`: generates reproducible `Connections.csv` and ZIP LinkedIn import fixtures.
- `scripts/seed-demo-user.mjs`: idempotent demo-data seed for one user's board with reusable people, notes, AI summaries, and connections.
- `src/main.tsx`: React entry point.
- `src/App.tsx`: current board behavior.
- `src/lib/supabase.ts`: browser Supabase client configuration.
- `src/lib/useAuth.ts`: session and Google sign-in state.
- `src/lib/useBoardGraph.ts`: board graph loading and mutation state.
- `src/lib/graphStorage.ts`: Supabase CRUD layer for people, tags, notes, `person_ai_notes`, and AI Edge Functions.
- `src/lib/graphTypes.ts`: shared graph interfaces, including the structured AI summary contract.
- `src/lib/userWorkspace.ts`: profile, board, and root-person bootstrap.
- `src/index.css`: current visual system.
- `skills-lock.json`: lockfile for installed project agent skills.
- `supabase/migrations/`: database schema and row-level security migrations.
- `supabase/functions/`: server-side Supabase Edge Functions for Gemini/OpenRouter AI note sync and AI people search.
- `supabase/tests/security_regression_checks.sql`: SQL security posture checks for live RLS and grants verification.

## Ownership

Task ownership is tracked in Linear. Code ownership is not split by directory yet.

## Next Steps

- Keep the persisted board interaction stable while product scope is finalized.
- Check `docs/PROBLEMS.md` before starting work, add newly discovered durable problems, and mark fixed problems as resolved.
- Keep `docs/SECURITY.md` aligned with storage, authentication, AI, deployment, and data-retention changes.
- Link any implementation task or pull request back to the relevant Linear issue.
- Update `docs/product-vision.md` when product scope changes.
- Update `docs/project-structure.md` and `docs/ARCHITECTURE.md` when source structure or boundaries change.
- Keep the local MCP server aligned with the Supabase schema and documentation resources.
- Keep Supabase Auth redirect URLs and Google OAuth origins aligned with every deployed frontend origin.
- Remember that commits on `main` deploy to the primary production site within about 3 minutes after they reach GitHub.
