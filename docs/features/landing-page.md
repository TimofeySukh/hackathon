# Landing Page

## Purpose

The landing page is the product entry screen for Social Datanode. Its focus is
sorting relationship chaos: loose contacts, notes, company zones, docs, and
connections become a visual board.

## Behavior

- Root visits show the landing page.
- Product CTAs switch to the board by setting `#board`.
- Header Log in and Sign up switch to `#board` and open the existing board auth dialog
  in the matching email auth mode.
- Header Product points back to the landing home.
- Header Docs opens `#docs`, a documentation page for API, CLI, and MCP notes.
- Header Contact opens `#contact`, currently a placeholder page.
- The interactive inspector demo lets visitors change a local-only person name,
  zone, photo preview, notes, and connections. The demo does not save data.

## Design

- The header is a compact black Linear-like pill, adapted to the Social Datanode
  theme and auth flow.
- The first viewport has three primary slogans above a stepped divider. A blue
  note below the divider acts as the board CTA.
- The page keeps the dotted board texture and Material 3 tokens, but removes the
  generic startup card stack.
- The main product demo is a concrete inspector panel, matching the board's
  person-editing workflow instead of an abstract marketing preview.
- Docs are moved to a separate landing route so API/CLI/MCP material does not
  crowd the product story.
- Narrow screens stack the slogans, board mock, inspector, and docs cards.

## Code

- Main component: [`LandingPage.tsx`](../../src/LandingPage.tsx)
- Stylesheet: [`landing.css`](../../src/styles/landing.css)
- App integration: [`App.tsx`](../../src/App.tsx)
