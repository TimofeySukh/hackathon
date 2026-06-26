# Feature Docs

One document per user-facing feature. Each doc captures what the feature is, how it
behaves, and how it should look — so anyone adding to or restyling it knows the intended
design without reverse-engineering `src/App.tsx`.

## Maintenance Rule

- When you build a new feature, copy [`_TEMPLATE.md`](_TEMPLATE.md) to
  `features/<feature-name>.md`, fill it in, and add it to the index below.
- When you change an existing feature's behavior or look, update its doc in the same
  change.
- Design choices reference [`../DESIGN_SYSTEM.md`](../DESIGN_SYSTEM.md). Do not restate
  global tokens here — link to them. Document only what is specific to this feature.
- Record durable cross-feature decisions in [`../DESIGN_LOG.md`](../DESIGN_LOG.md), not
  inside a feature doc.

## Index

- [Board canvas](board-canvas.md) — the relationship graph surface: circles, people,
  connections, pan/zoom, create menu, inspector.
- [Person notes (Trello-Style)](person-notes.md) — Trello-style notes list column, cards, composer, and inline editing.
- [Person connections](person-connections.md) — profile links, social handles, phone-app links, LinkedIn import links, and quick open/delete controls.
- [Board search](board-search.md) — find a person (name/role) or circle (tag) from the toolbar and fly the camera to it.
- [Authentication](auth.md) — local editing, Google sign-in, email/password registration, confirmation resend, and password reset.
- [Import load testing](import-load-testing.md) — isolated database load checks and browser responsiveness verification for large LinkedIn imports.
