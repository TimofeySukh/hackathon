# Feature Docs

One document per user-facing feature. Each doc captures what the feature is, how it
behaves, and how it should look — so anyone adding to or restyling it knows the intended
design without reverse-engineering `src/App.tsx`.

**Canonical summary:** [`../AI_CONTEXT.md`](../AI_CONTEXT.md) — read first when onboarding
humans or AI agents.

## Maintenance Rule

- When you build a new feature, copy [`_TEMPLATE.md`](_TEMPLATE.md) to
  `features/<feature-name>.md`, fill it in, and add it to the index below.
- When you change an existing feature's behavior or look, update its doc in the same
  change.
- Design choices reference [`../DESIGN_SYSTEM.md`](../DESIGN_SYSTEM.md). Do not restate
  global tokens here — link to them. Document only what is specific to this feature.
- Record durable cross-feature decisions in [`../DESIGN_LOG.md`](../DESIGN_LOG.md), not
  inside a feature doc.
- Use relative repo paths in Code sections (not absolute machine paths).

## Index

- [Board canvas](board-canvas.md) — relationship graph surface: circles, people,
  connections, pan/zoom, direct touch controls, create menu, inspector.
- [Board onboarding](onboarding.md) — first-run board guide for controls and mobile gestures.
- [Person notes (Trello-style)](person-notes.md) — notes list, cards, composer, inline editing.
- [Person connections](person-connections.md) — profile links, social handles, phone-app links, LinkedIn import links.
- [Board search](board-search.md) — find people/circles; fly camera; LinkedIn URL import.
- [Smart search](smart-search.md) — signed-in natural-language search with AI interpretation.
- [Local LinkedIn agent search](local-linkedin-agent-search.md) — read-only local JSONL retrieval (30k/50k token budgets).
- [Authentication](auth.md) — local editing, Google/email auth, recovery, sign-in entry points.
- [Anonymous persistence](anonymous-persistence.md) — IndexedDB graph storage, legacy migration, and visible save failures.
- [Import load testing](import-load-testing.md) — database and browser import verification.
- [Landing page](landing-page.md) — marketing entry, hash routing, inspector demo.
- [Developer documentation](developer-docs.md) — product-integrated MCP, CLI, and REST API guides.
- [Agent API](agent-api.md) — revocable tokens, graph API, CLI, MCP.
- [Real-time sync](realtime-sync.md) — Supabase Realtime for multi-tab/agent edits.

Public API/CLI/MCP article content remains in `src/DocsPage.tsx`; the developer documentation
feature entry above describes its shell, navigation, search, and design behavior.
