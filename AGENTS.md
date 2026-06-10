# AGENTS.md

This repo follows the harness guidance in `docs/`.

## Start Here

- [Project map](docs/PROJECT_MAP.md)
- [Runbook](docs/RUNBOOK.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Problems](docs/PROBLEMS.md)
- [Design system](docs/DESIGN_SYSTEM.md)
- [Feature docs](docs/features/README.md)
- [Design log](docs/DESIGN_LOG.md)

## Rules

- Keep all user-facing text, comments, and documentation in English.
- Treat `docs/` as the source of truth for project knowledge.
- Update the relevant doc when behavior, structure, or commands change.
- Check `docs/PROBLEMS.md` before work and update it when a new problem appears or an old problem is resolved.
- Follow `docs/DESIGN_SYSTEM.md` (Material 3) for any UI. New UI ships Material 3 from the start; do not copy the old chrome style.
- Document each new feature under `docs/features/` (copy `_TEMPLATE.md`), and record durable design decisions in `docs/DESIGN_LOG.md`.
- Always create a commit after making changes.
- Always restart the local server after making changes.
- Keep this file short. Add project detail to `docs/`, not here.
