# Agent Best Practices

This project follows the local `agents-best-practices` guidance for agent-facing APIs,
MCP tools, and documentation. Treat this file as the project-local summary of the rules
that matter for DataNode.

## Source of truth

- Keep durable project knowledge in `docs/`, not in chat history.
- Keep `AGENTS.md` short and route detailed guidance to project docs.
- When API endpoints, CLI commands, or MCP tools change, update `src/DocsPage.tsx`,
  `docs/RUNBOOK.md`, and the relevant feature doc in the same change.

## MCP and connector rules

- MCP is a connector capability layer, not a dumping ground for every possible command.
- Tool names must stay narrow and domain-specific.
- Tool schemas must be strict: explicit required fields, enums where possible, and
  `additionalProperties: false` for fixed payloads.
- Tool definitions must expose risk metadata, side-effect class, resource scope, and
  permission policy.
- The MCP surface should include compact capability discovery so agents can select tools
  from a short risk-aware list before using detailed schemas.
- Tool results must be structured observations with `status`, `summary`, `data`, and
  `next_valid_actions`.
- Do not return unnecessary raw blobs. Return compact summaries for routine tools; only
  return full graph payloads for explicit backup/export use cases.

## Permissions and safety

- Authentication only proves the caller has a token. Authorization is enforced by server
  scopes and graph ownership.
- Agent tokens must remain hashed at rest, revocable, scoped, and mapped to exactly one
  user.
- The model never receives service-role secrets or Supabase project credentials.
- All graph writes must remain revision-checked with `expectedRevision`.
- Destructive or broad graph operations must require the `graph:replace` scope at the API
  layer. Agents should create an `export_graph` backup or ask for user confirmation before
  large, experimental, bulk, replacement, reset, or broad cleanup work.

## Interface parity

- API, CLI, and MCP must stay functionally equivalent for graph operations.
- If `supabase/functions/graph-api/index.ts` adds or changes an operation, update
  `scripts/datanode-api-client.mjs`, `scripts/datanode-cli.mjs`,
  `scripts/datanode-mcp.mjs`, and `src/DocsPage.tsx` before shipping.
- Keep result and error semantics consistent across interfaces: revision conflicts,
  missing scopes, invalid arguments, and not-found cases should be legible to agents.

## Evaluation checklist

- A fresh agent can find setup instructions in `docs/RUNBOOK.md`.
- Public developer docs match the shipped API, CLI, and MCP tools.
- MCP tools reject unknown arguments before calling the API.
- Risky tools are clearly marked and server permissions still enforce the real boundary.
- Large graph changes have a backup or confirmation path.
