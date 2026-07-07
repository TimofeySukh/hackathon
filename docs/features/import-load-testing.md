# Import Load Testing

## Purpose

Import load testing verifies that large contact imports stay isolated from production data,
persist as a bounded database operation, and keep the browser responsive while the import
is being processed.

The current persistence model stores the whole board graph in one `user_graphs.graph`
`jsonb` blob per user. A 3,000-person import should therefore be one upsert to Supabase,
not thousands of per-contact database writes.

## Behavior

- LinkedIn ZIP import reads `Connections.csv` from the uploaded archive. When present, it
  also reads Part 1 context files (`Positions.csv`, `Rich_Media.csv`,
  `Shares.csv`, `Recommendations_Received.csv`, `Recommendations_Given.csv`) to add
  deterministic context notes.
- The import groups people by company, creates missing company circles, and adds new
  people under those circles.
- Deterministic context is stored only as regular person notes: `Professional Context`,
  `Shared Company Context`, `Event Context`, and `Trust Context`. Re-imports add missing
  context notes to existing imported people without duplicating the same `title + body`.
- `Event Context` is attached when a connection date is within two days of a LinkedIn
  post date; large same-day connection spikes still produce stronger wording, but a spike
  is no longer required.
- For signed-in users, the app automatically calls the `enrich-linkedin-archive` Edge
  Function after the ZIP import finishes. LLM notes are generated from `messages.csv` /
  `guide_messages.csv`, `Invitations.csv`, and post exports. The archive stays in memory
  for that tab while processing. Raw text is sent only for transient server-side
  processing; the graph persists only returned notes such as `AI Relationship Summary`,
  `Origin Context`, `AI Event Context`, and `Action Items`. Professional title
  classification stays in the deterministic import notes so AI context progress reflects
  relationship-oriented context.
- Message and invitation excerpts sent to the archive enrichment Edge Function include
  exact matched `personIds` when the browser can resolve them from profile URLs, names, or
  profile slugs. Message context is capped per batch with a per-person balance so one long
  conversation cannot crowd out another matched person's correspondence.
- When both `messages.csv` and `guide_messages.csv` exist, `messages.csv` is preferred and
  any non-empty guide rows are appended. Header-only `guide_messages.csv` files must not
  mask the real message export. Name fallback matching requires all meaningful name parts
  to be present, preventing one shared first name or surname from assigning messages to the
  wrong person.
- New LinkedIn company circles use a stable deterministic tone from the Material 3 circle
  palette instead of defaulting every imported company to blue. Existing company circles
  keep their current tone on re-import, except legacy default-blue LinkedIn company circles
  without a custom color are migrated to the deterministic tone.
- Imported nodes are placed **non-overlapping up front** so the O(n²) collision relaxer
  never has to untangle a pile-up: people are sunflower-packed inside their company
  (`personPackOffset`), each company circle is sized to its member count
  (`packedCircleRadius`), and company circles are packed into compact concentric rings
  around `you` (`packCirclesInRings`). Above `IMPORT_LAYOUT_LIMIT` nodes the global
  containment relax is skipped because the layout is already clean. See the 2026-06-15
  "Bulk import lays out non-overlapping" entry in `../DESIGN_LOG.md`.
- Existing company circles grow to the packed radius required by their final member count
  during re-imports and single-profile LinkedIn enrichment. The packed radius includes a
  small visual padding beyond mathematical avatar containment so dense circles do not look
  clipped when global cleanup is skipped.
- Saved graphs are normalized on load with the same packed-radius rule for LinkedIn
  company circles, so older undersized boards recover after reload without requiring a
  fresh import. Loading does not repack circle positions, because moving saved circles on
  every load feels like the board teleported.
- Top-level LinkedIn company circles are repacked after ZIP imports/re-imports. Their
  contained people move with them, preventing a grown company circle from covering
  neighboring company circles during a deliberate bulk import.
- Large imports are processed in chunks that yield back to the browser between batches,
  so the settings panel can repaint and the event loop is not blocked for the whole import.
- After a successful import, the resulting graph is written immediately to the active
  storage backend (Supabase for signed-in users, `localStorage` for anonymous users)
  before the success alert is shown. The normal debounced autosave then skips the same
  unchanged snapshot.
- Graph persistence strips Postgres-unsafe NUL characters and replaces invalid lone
  UTF-16 surrogate code units before writing the board to `jsonb`. This protects imports
  from malformed characters that can appear in exported contact data and otherwise cause
  PostgREST `PGRST102` "Empty or invalid json" write failures.
- Signed-in graph writes use the existing `graph-api` Edge Function replacement route as
  the primary path so import persistence shares the same revision-checked contract as
  API/CLI/MCP graph replacement.
- If the browser receives a non-conflict failure from `graph-api`, it retries the same
  revision-checked save directly through Supabase RLS using explicit PostgREST `fetch`
  calls and pre-serialized JSON. This keeps imports recoverable when the deployed
  function is stale or temporarily failing, without silently ignoring revision conflicts
  or depending on client-library serialization for large graph blobs.
- The import button is disabled while a ZIP import is running and shows `Importing...`.
- Duplicate imported people are skipped by generated LinkedIn person id.

## Verification

Run the default load checks:

```bash
npm run test:load
```

This runs:

- `npm run test:db-load -- --people 3000 --connections 3000`
- `npm run test:ui-import -- --people 3000`
- `npm run test:ui-import:persistence`

The database load test is dry-run by default. It generates the same graph payload shape
that Supabase receives and reports the serialized size without writing anything.

Hosted database writes require all of the following:

```bash
HACKATHON_ALLOW_DATABASE_LOAD_TEST=true npm run test:db-load -- --write --cleanup
```

The write path refuses to run against the URL in `.env.production`. It creates an isolated
Supabase Auth user, upserts one `user_graphs` row for that user, reads it back, and deletes
the test user when `--cleanup` is provided.

The UI responsiveness test starts Vite, opens the app in Chromium, uploads a generated
LinkedIn ZIP through the real file input, and fails if event-loop lag exceeds the configured
threshold.

Run the local signed-in persistence check before changing import persistence:

```bash
npm run test:ui-import:persistence
```

This uses a mock Supabase graph API and minimal mock PostgREST endpoint on localhost plus
`VITE_E2E_FAKE_AUTH=true`. It verifies that LinkedIn ZIP import and graph JSON import write
through the signed-in persistence path, survive a page reload, recover the latest revision
when `409 Conflict` omits it, fall back to direct Supabase persistence after a graph API
failure, and can replace the graph even after an initial graph load failure, without
touching production data. The generated LinkedIn CSV also includes Postgres-unsafe text
characters so the test fails if graph persistence sends raw `\u0000` or invalid surrogate
escapes to PostgREST.

Useful overrides:

```bash
npm run test:db-load -- --people 5000 --connections 5000
npm run test:ui-import -- --people 5000 --max-lag-ms 1500
npm run test:ui-import -- --url http://127.0.0.1:5173
npm run test:ui-import:persistence -- --people 500 --companies 25
```

If Chromium is not installed for Playwright:

```bash
npx playwright install chromium
```

## Production Isolation

- Never run synthetic import checks from a real user account in production.
- Use a separate Supabase project for staging and load tests.
- Keep service-role keys only in shell environment or a local ignored env file, never in
  `VITE_` variables.
- Test-only database writes require `HACKATHON_ALLOW_DATABASE_LOAD_TEST=true`.
- The database load script compares the target URL with `.env.production` and exits before
  writing if they match.
