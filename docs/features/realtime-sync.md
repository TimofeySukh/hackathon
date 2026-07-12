# Real-Time Automatic Synchronization

## Purpose

Keeps the board canvas synchronized when the graph changes externally (another browser tab,
CLI, MCP agent, or API client) without polling or manual reload — while protecting unsaved
local edits.

## Behavior

- Signed-in clients subscribe to Postgres changes on the current user's `user_graphs` row.
- When the **same tab** receives a Realtime `UPDATE` for a save it already has in flight,
  the event is treated as acknowledgement (revision refresh), not an external conflict.
- **No unsaved local changes:** the canvas updates to the remote graph immediately.
- **Unsaved local changes exist:** a warning banner appears, autosave pauses, and the user
  must reload to reconcile (optimistic concurrency).
- A client that loaded an empty account still treats a later insert by another client as a
  conflict. `expectedRevision: null` never auto-adopts the new revision for autosave.
- Only an explicit full graph JSON import may recover an unknown revision and retry the
  replacement once after an initial load failure.

## Design

- Warning banner at top of viewport: `--md-error-container` / `--md-on-error-container`.
- Prominent **Reload Page** button resolves conflicts.

## Code

- **Migration:** [`../../supabase/migrations/20260624130017_enable_realtime_for_user_graphs.sql`](../../supabase/migrations/20260624130017_enable_realtime_for_user_graphs.sql)
- **Frontend:** Realtime subscription in [`../../src/App.tsx`](../../src/App.tsx) and helpers in
  [`../../src/lib/graphPersistence.ts`](../../src/lib/graphPersistence.ts)
- **Key refs:** `graphRef`, `loadedGraphRevisionRef`, `loadedGraphSnapshotRef`,
  `pendingSaveGraphRef`, `pendingSaveSnapshotRef`, `isGraphStateEqual`
- **Regression coverage:** `scripts/test-ui-import-persistence.mjs` opens two clients on an
  empty account and verifies that the stale client cannot replace the first writer.

## Open questions / TODO

- None.
