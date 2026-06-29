# Real-Time Automatic Synchronization

## Purpose

Ensures that the web application's board canvas stays synchronized in real-time when changes are made externally (e.g., via the CLI, API, or an MCP agent) without requiring the user to reload the page or forcing the app to poll Supabase.

## Behavior

- When the database is updated externally, the web app automatically receives a database change event.
- When the current browser tab receives the Realtime event for a save it already has in flight, the event is accepted as the save acknowledgement instead of being treated as an external edit.
- **No Unsaved Local Changes**: The web app automatically updates the canvas to reflect the new state immediately and seamlessly.
- **Unsaved Local Changes Exist**: To prevent overwriting the user's unsaved changes, the app displays a banner notifying the user that the board has changed elsewhere and pauses autosaving until the user reloads the page.

## Design

- Uses a warning banner at the top of the viewport when a conflict occurs.
- The banner fits the Material 3 styling using the `error-container` background role and the `on-error-container` text color role.
- Shows a prominent button for the user to "Reload Page" to resolve the conflict.

## Code

- **Database Changes**: Subscribes to the `user_graphs` table in Postgres using the `supabase_realtime` publication.
  - Migration file: [20260624130017_enable_realtime_for_user_graphs.sql](file:///Users/velizard/Projects/hackathon/supabase/migrations/20260624130017_enable_realtime_for_user_graphs.sql)
- **Frontend listener**: A `useEffect` in [App.tsx](file:///Users/velizard/Projects/hackathon/src/App.tsx) creates a Supabase Realtime subscription.
- **State & Refs**:
  - `graphRef`: Holds the current `graph` state to prevent re-binding the listener when graph state changes.
  - `loadedGraphRevisionRef`: Holds the currently loaded revision for optimistic concurrency and stale event filtering.
  - `loadedGraphSnapshotRef`: Stores the last loaded/saved graph state.
  - `pendingSaveGraphRef` / `pendingSaveSnapshotRef`: Track a local save request while it is in flight, so the matching Realtime `UPDATE` can refresh the saved revision without showing a false external-conflict warning.
- **Utilities**:
  - `isGraphStateEqual` and `deepEqual`: Semantic comparison functions in `src/App.tsx` used to determine whether the user has unsaved modifications.

## Open questions / TODO

- None.
