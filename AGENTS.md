# AGENTS.md

This repo follows the harness guidance in `docs/`.

## Start Here

- [Project map](docs/PROJECT_MAP.md)
- [Runbook](docs/RUNBOOK.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Design system](docs/DESIGN_SYSTEM.md)
- [Feature docs](docs/features/README.md)
- [Design log](docs/DESIGN_LOG.md)

## Rules

- Keep all application user-facing text, comments, documentation, and codebase elements in English. Chat responses to the user can be in the user's preferred language.
- Treat `docs/` as the source of truth for project knowledge.
- Update the relevant doc when behavior, structure, or commands change.
- When modifying API endpoints, CLI commands, or MCP tools, always update the public developer documentation in `src/DocsPage.tsx` to keep the website docs synchronized.
- Maintain strict functional parity across all interfaces: when updating or adding API endpoints in `supabase/functions/graph-api/index.ts`, ensure that equivalent commands are added to the CLI (`scripts/datanode-cli.mjs`) and tools to the MCP server (`scripts/datanode-mcp.mjs`) immediately.
- Follow `docs/DESIGN_SYSTEM.md` (Material 3) for any UI. New UI ships Material 3 from the start; do not copy the old chrome style.
- Document each new feature under `docs/features/` (copy `_TEMPLATE.md`), and record durable design decisions in `docs/DESIGN_LOG.md`.
- Always create a commit after making changes.
- Always restart the local server after making changes.
- Install missing local verification tools when needed instead of skipping checks.
- Keep this file short. Add project detail to `docs/`, not here.
