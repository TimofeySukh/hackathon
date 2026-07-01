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

## Design

- Warning banner at top of viewport: `--md-error-container` / `--md-on-error-container`.
- Prominent **Reload Page** button resolves conflicts.

## Code

- **Migration:** [`../../supabase/migrations/20260624130017_enable_realtime_for_user_graphs.sql`](../../supabase/migrations/20260624130017_enable_realtime_for_user_graphs.sql)
- **Frontend:** Realtime subscription in [`../../src/App.tsx`](../../src/App.tsx) and helpers in
  [`../../src/lib/graphPersistence.ts`](../../src/lib/graphPersistence.ts)
- **Key refs:** `graphRef`, `loadedGraphRevisionRef`, `loadedGraphSnapshotRef`,
  `pendingSaveGraphRef`, `pendingSaveSnapshotRef`, `isGraphStateEqual`

## Open questions / TODO

- None.
