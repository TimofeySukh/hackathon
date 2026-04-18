# Project Map

## Current State

This repository contains a minimal React, Vite, and TypeScript infinite board app.

The current product is intentionally narrow:

- a full-window board surface
- mouse drag navigation
- a dark/light theme toggle
- a CSS-rendered point grid
- no drawing tools, side panels, persistence, backend, or collaboration yet

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
- `docs/PROJECT_MAP.md`: where the project structure is recorded.
- `docs/RUNBOOK.md`: how to run or verify the repo.
- `docs/ARCHITECTURE.md`: invariants and boundaries.
- `docs/product-vision.md`: product direction and scope.
- `docs/project-structure.md`: file-by-file project structure notes.
- `README.md`: top-level overview and local development commands.
- `src/main.tsx`: React entry point.
- `src/App.tsx`: current board behavior.
- `src/index.css`: current visual system.

## Ownership

Task ownership is tracked in Linear. Code ownership is not split by directory yet.

## Next Steps

- Keep the minimal board interaction stable while product scope is finalized.
- Link any implementation task or pull request back to the relevant Linear issue.
- Update `docs/product-vision.md` when product scope changes.
- Update `docs/project-structure.md` and `docs/ARCHITECTURE.md` when source structure or boundaries change.
- Add focused verification before the first substantial pull request.
