# Quality Hardening Design

Date: 2026-07-12
Status: Approved direction; implementation pending written-spec review

## Goal

Harden Social Datanode around graph integrity, local persistence, release verification,
dependency security, initial-load performance, and maintainability without changing the
product's user-visible graph model or API/CLI/MCP behavior.

## Considered Approaches

### 1. Staged hardening in the current architecture — recommended

Keep the single JSONB graph and existing hash routes, but make concurrency policies
explicit, replace fragile local persistence, add deterministic verification gates, and
extract only the modules needed to enable lazy loading and isolated tests.

This gives the highest risk reduction with bounded migrations and preserves interface
parity.

### 2. Normalize the graph into relational tables

Move circles, people, notes, and connections into separate Postgres tables. This would
enable smaller writes and richer server queries, but it requires a data migration and a
coordinated rewrite of the browser, graph API, CLI, and MCP server. It is not justified by
the current audit and is explicitly out of scope for this package.

### 3. Apply only narrow patches

Fix the failing test, add a dependency override, and silence warnings. This is faster, but
it leaves the local-data-loss and revision-race paths intact and does not create a reliable
release gate. It does not meet the approved goal.

## Design

### Graph revision integrity

`saveGraph` will remain strict by default: any `409 Conflict`, including one received when
the caller expected no row, will reach the caller as `GraphRevisionConflictError`.

Recovering an unknown revision and replacing the current graph will move into an explicit
operation used only by the full graph JSON import after a user-selected file. Autosave,
LinkedIn merge import, AI enrichment, CLI, and MCP writes will never use that policy.

A browser test will cover two clients that both load an empty account: after one client
saves, the second client's stale save must conflict and must not replace the first graph.

### Anonymous persistence

Anonymous graphs will use a small IndexedDB adapter as the primary store. Existing
`localStorage` data will be read once, written to IndexedDB, and removed only after the
IndexedDB write succeeds. IndexedDB failures will propagate to the application instead of
being logged and ignored.

The board will expose a visible persistence error and will not mark a failed snapshot as
saved. Immediate imports will report failure instead of showing a success alert. A local
browser test will import a graph larger than the practical localStorage range, reload, and
verify that it survives.

### Deterministic tests and release gate

The LinkedIn incremental-enrichment test will record the enrichment-request baseline
before re-import and wait for a request created after that baseline that contains the
expected new person. It will not infer logical runs from a global request ordinal.

Package scripts will expose the existing mobile smoke tests and a single CI command. A new
GitHub Actions workflow will run on pull requests and pushes to `main` and `production`:

1. `npm ci`
2. production dependency audit
3. lint with zero warnings
4. TypeScript/Vite build
5. deterministic browser and import tests

The production-promotion workflow will verify the selected commit through the same
quality command before moving the `production` branch.

### Dependency security

Supabase JS will be updated within its current major version to a release whose Realtime
dependency no longer resolves to vulnerable `ws@8.20.0`. The lockfile result, not a broad
major-version upgrade, is the acceptance criterion. Auth, Realtime, graph API fallback,
and import persistence tests must pass after the update.

### Initial-load performance

Public route components and the LinkedIn ZIP implementation will be loaded dynamically.
The ZIP library will not be part of the initial route chunk. The landing-board screenshot
will be converted to a modern web format while preserving its intrinsic dimensions and
accessible alternative text.

The production build must produce multiple chunks, no initial JavaScript chunk above 500
kB minified, and a materially smaller landing image. If route-level splitting requires a
large auth-shell rewrite, the package will stop at module-level splitting only if it still
meets the measurable chunk threshold.

### App decomposition and hook correctness

Refactoring will target boundaries directly involved in this package rather than rewrite
the whole board:

- anonymous graph storage;
- graph conflict policy;
- LinkedIn archive parsing and enrichment-scope helpers;
- lazy public routes and ZIP loading.

Functions moved out of `App.tsx` will have explicit typed inputs and no React state access.
All seven current hook dependency warnings will be resolved through stable callbacks,
refs, or corrected dependency lists; warnings will not be disabled merely to satisfy CI.

## Error Handling

- Conflict errors stop writes and show the existing reload guidance.
- Explicit full-graph replacement may recover an unknown revision once; a second conflict
  stops the operation.
- IndexedDB or serialization errors remain visible until a later save succeeds.
- Dynamic-import failures use the existing user-facing import error path.
- CI and production promotion fail closed when any required check fails.

## Documentation

Implementation will update:

- `docs/AI_CONTEXT.md` for canonical persistence and structure changes;
- `docs/ARCHITECTURE.md` for IndexedDB and conflict-policy boundaries;
- `docs/RUNBOOK.md` for CI and verification commands;
- the relevant feature docs for import load testing and Realtime behavior;
- `docs/DESIGN_LOG.md` for the durable persistence and conflict-policy decisions.

No developer-facing API, CLI, or MCP contract is planned to change, so
`src/DocsPage.tsx` should remain unchanged unless implementation reveals a necessary
interface change.

## Acceptance Criteria

- A stale empty-account writer cannot overwrite a graph created by another client.
- Full graph JSON import remains able to replace a saved graph after an initial load
  failure, because that action is explicit.
- Anonymous large-graph import survives reload, and storage failure is visible.
- `npm run test:load` is deterministic at its default size.
- Mobile smoke tests are part of the standard quality command.
- Lint reports zero warnings and build succeeds.
- `npm audit --omit=dev` reports no high or critical vulnerabilities.
- Production promotion runs the quality gate before moving the branch.
- The initial JavaScript chunk is below 500 kB minified and the landing image is smaller.
- Canonical docs match the resulting implementation.
- The local development server is restarted after implementation.

## Out of Scope

- Relational normalization of the graph JSONB blob.
- Changes to graph API, CLI, or MCP feature parity.
- New product features or visual redesigns.
- Deployment of Supabase functions or database migrations.
