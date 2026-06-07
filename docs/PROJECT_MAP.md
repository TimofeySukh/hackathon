# Project Map

## Current State

This repository contains a React, Vite, and TypeScript social graph board app.

The current visible prototype is intentionally narrow:

- a full-window relationship circle graph
- a central `You` circle
- seeded connected circles and nested subset circles
- people placed inside parent circles or subsets
- curved SVG links from circle centers to people and circles
- branch creation by dragging from a circle-center plus handle
- a create menu for choosing person, nested subset circle, or external connected circle
- direct dragging for people and circle centers
- circle subtree movement for contained people and nested circles
- circle resizing from a boundary handle
- automatic containment expansion through nested parent chains
- selection and renaming through a right-side inspector
- local pan and zoom
- browser-session-only state
- no visible Supabase, auth, LinkedIn import, persistence, notes, AI search, or collaboration in this prototype screen

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
- `docs/product-vision.md`: product direction and scope.
- `docs/project-structure.md`: file-by-file project structure notes.
- `README.md`: top-level overview and local development commands.
- `.env.mcp.example`: local-only MCP environment template for service-role access.
- `.mcp.json`: project MCP configuration for the local Hackathon board stdio server.
- `mcp/server.mjs`: local MCP server that exposes project docs and board graph tooling.
- `scripts/seed-demo-user.mjs`: idempotent demo-data seed for one user's board with reusable people, notes, AI summaries, and connections.
- `src/main.tsx`: React entry point.
- `src/App.tsx`: current local circle graph prototype behavior.
- `src/lib/supabase.ts`: browser Supabase client configuration.
- `src/lib/useAuth.ts`: session and Google sign-in state.
- `src/lib/useBoardGraph.ts`: board graph loading and mutation state.
- `src/lib/graphStorage.ts`: Supabase CRUD layer for people, tags, notes, `person_ai_notes`, and AI Edge Functions.
- `src/lib/graphTypes.ts`: shared graph interfaces, including the structured AI summary contract.
- `src/lib/userWorkspace.ts`: profile, board, and root-person bootstrap.
- `src/index.css`: current circle graph prototype visual system.
- `skills-lock.json`: lockfile for installed project agent skills.
- `supabase/migrations/`: database schema and row-level security migrations.
- `supabase/functions/`: server-side Supabase Edge Functions for Gemini/OpenRouter AI note sync and AI people search.

## Ownership

Task ownership is tracked in Linear. Code ownership is not split by directory yet.

## Next Steps

- Keep the circle graph prototype easy to evaluate while product scope is finalized.
- Check `docs/PROBLEMS.md` before starting work, add newly discovered durable problems, and mark fixed problems as resolved.
- Link any implementation task or pull request back to the relevant Linear issue.
- Update `docs/product-vision.md` when product scope changes.
- Update `docs/project-structure.md` and `docs/ARCHITECTURE.md` when source structure or boundaries change.
- Keep the local MCP server aligned with the Supabase schema and documentation resources.
- Keep Supabase Auth redirect URLs and Google OAuth origins aligned with every deployed frontend origin.
- Remember that commits on `main` deploy to the primary production site within about 3 minutes after they reach GitHub.
