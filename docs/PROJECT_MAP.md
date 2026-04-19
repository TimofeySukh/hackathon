# Project Map

## Current State

This repository contains a React, Vite, and TypeScript social graph board app.

The current product is intentionally narrow:

- a full-window board surface
- mouse drag navigation
- a dark/light theme toggle
- a very dense CSS-rendered point grid with motion-triggered point highlights
- Supabase-backed Google login
- one personal board record per signed-in user
- persistent people nodes, reusable colored tags, notes, and undirected connections per signed-in user
- a top-left Tags menu for creating tags and changing tag colors
- a node-anchored inspector for editing the selected person that opens on single click
- a people search layer that matches locally while typing and can run AI search on Enter
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
- [VEL-12 Design the n8n workflow](https://linear.app/velizard/issue/VEL-12/design-the-n8n-workflow)
- [VEL-13 Evaluate n8n and decide whether to use it](https://linear.app/velizard/issue/VEL-13/evaluate-n8n-and-decide-whether-to-use-it)
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
- `docs/product-vision.md`: product direction and scope.
- `docs/project-structure.md`: file-by-file project structure notes.
- `README.md`: top-level overview and local development commands.
- `.env.mcp.example`: local MCP environment template for service-role access plus optional HTTP host, port, and host allowlist settings.
- `.mcp.json`: project MCP configuration for the shared `n8n-mcp` HTTP server and the local Hackathon board stdio server.
- `mcp/server.mjs`: local MCP stdio entrypoint plus shared server factory for docs and board graph tooling.
- `mcp/http-server.mjs`: LAN-accessible Streamable HTTP entrypoint for the local Hackathon MCP server.
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
- `supabase/functions/`: server-side Supabase Edge Functions for n8n AI note sync and AI people search.

## Ownership

Task ownership is tracked in Linear. Code ownership is not split by directory yet.

## Next Steps

- Keep the persisted board interaction stable while product scope is finalized.
- Link any implementation task or pull request back to the relevant Linear issue.
- Update `docs/product-vision.md` when product scope changes.
- Update `docs/project-structure.md` and `docs/ARCHITECTURE.md` when source structure or boundaries change.
- Keep the local MCP server aligned with the Supabase schema and documentation resources.
- Keep Supabase Auth redirect URLs and Google OAuth origins aligned with every deployed frontend origin.
