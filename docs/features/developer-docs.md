# Developer documentation

## Purpose

The public developer documentation helps founders, operators, and developers connect an
AI client, use the terminal CLI, or build directly against the revision-safe REST API. It
continues the Social Datanode public-site experience instead of presenting a separate
administration-style portal.

## Behavior

- The landing-page `Docs` link opens `#docs`; articles use stable `#docs/<article-id>` deep
  links.
- The docs home introduces MCP, CLI, and REST API as three task-led starting paths.
- Desktop keeps the documentation contents visible in a left sidebar. On smaller screens,
  `Contents` opens a modal navigation drawer; Escape, the close action, or the scrim closes
  it and focus returns to the trigger.
- Search covers article titles, endpoint paths, commands, tools, and topic keywords. Arrow
  keys change the active result, Enter opens it, and Escape clears and closes search.
- Unknown article ids show a visible not-found state with a route back to the docs home.
- Every article has one page-level heading. Rendered prose uses semantic emphasis and code
  elements rather than displaying Markdown authoring characters.
- Copy buttons place examples on the clipboard and announce success in a snackbar.

## Design

The page follows the Material 3 rules in [`../DESIGN_SYSTEM.md`](../DESIGN_SYSTEM.md) and
shares the landing page's Social Datanode identity, public navigation, rounded surfaces,
and calm light palette.

- Surfaces / elevation used: translucent product header, low sidebar and cards, elevated
  search results and mobile drawer.
- Components used: filled/text buttons, active tonal navigation, search combobox, modal
  drawer, quick-start cards, tables, alerts, code blocks, and snackbar.
- Color roles used: standard Material surface, primary, secondary-container, outline, and
  error roles.
- HTTP methods and the dark code viewer use feature-specific semantic tokens because they
  communicate protocol and syntax meaning not covered by the base Material roles.
- Quick-start cards form three columns on desktop and one horizontally scrollable, peeking
  row on phones so authentication content still begins in the first viewport.
- Motion is limited to drawer and scrim transitions and respects reduced-motion settings.

## Code

- Main file(s): `src/DocsPage.tsx`, `src/features/docs/`, `src/styles/docs.css`.
- Key components: `DocsHeader`, `DocsSidebar`, `DocsQuickStart`.
- Related state / hooks: hash-derived article selection, indexed search tokens, collapsed
  navigation groups, mobile drawer state, and copy feedback.
- Regression coverage: `scripts/test-public-routes.mjs`.

## Open questions / TODO

- Article bodies remain colocated in `src/DocsPage.tsx` so API/CLI/MCP parity can be audited
  in one place. If authoring volume grows, move bodies into topic modules while retaining a
  single typed navigation and search registry.

