# Anonymous persistence

## Purpose

Keeps a signed-out user's board available in the same browser without requiring an
account, including graphs too large for reliable synchronous web storage.

## Behavior

- Signed-out and unconfigured sessions load and save one active graph in IndexedDB.
- Existing graphs under the legacy `hackathon-board:local-graph` localStorage key migrate
  automatically. The legacy value is removed only after IndexedDB confirms the write.
- Debounced edits and immediate graph/LinkedIn imports use the same asynchronous store.
- A failed write does not update the last-saved snapshot and shows a persistent error
  banner. An immediate import reports failure instead of success.
- Onboarding demo data is temporary and is never written to the local store.
- Signing in switches to the revision-checked Supabase graph; local data is not uploaded
  implicitly.

## Design

- Storage failures use the existing Material 3 error-container banner above the board.
- The banner includes the existing reload action and remains visible until a later local
  write succeeds.
- There is no storage-management panel or quota meter.

## Code

- Main files: `../../src/lib/localGraphStore.ts`, `../../src/App.tsx`
- Key functions: `loadLocalGraph`, `saveLocalGraph`, `persistGraphImmediately`
- Browser verification: `../../scripts/test-local-graph-persistence.mjs`

## Open questions / TODO

- Consider a user-invoked retry action if browsers commonly recover from transient
  IndexedDB failures without another graph edit.
