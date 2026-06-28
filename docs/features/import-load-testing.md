# Import Load Testing

## Purpose

Import load testing verifies that large contact imports stay isolated from production data,
persist as a bounded database operation, and keep the browser responsive while the import
is being processed.

The current persistence model stores the whole board graph in one `user_graphs.graph`
`jsonb` blob per user. A 3,000-person import should therefore be one upsert to Supabase,
not thousands of per-contact database writes.

## Behavior

- LinkedIn ZIP import reads `Connections.csv` from the uploaded archive.
- The import groups people by company, creates missing company circles, and adds new
  people under those circles.
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
- Signed-in graph writes go through the existing `graph-api` Edge Function replacement
  route so import persistence uses the same revision-checked server path as API/CLI/MCP
  graph replacement.
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

This uses a mock Supabase graph API on localhost plus `VITE_E2E_FAKE_AUTH=true`. It verifies
that LinkedIn ZIP import and graph JSON import write through the signed-in persistence path
and survive a page reload without touching production data.

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
