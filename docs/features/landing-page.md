# Landing Page

## Purpose

The landing page is the startup-style product entry screen. It explains Social Datanode
as a visual relationship workspace and drives users into the board app.

## Behavior

- Root visits show the landing page.
- The "Open product" button switches to the board by setting `#board`.
- The top navigation links scroll within the landing page.
- The hero has an interactive workflow switcher for fundraise, hiring, and reconnecting.
- The workflow section has interactive step tabs that update the explanatory card.

## Design

- The background uses a soft blue-white Material 3-tonal gradient with a subtle dotted board
  texture.
- The hero keeps the diagonal uneven staircase motif from the prototype. The separator uses
  the board bubble language: wide pale blue body, dark blue outline, and soft rounded bends.
- Product claims are written as separate overlapping Trello-style note cards, not as a
  conventional marketing card stack.
- The first viewport pairs a large startup-style headline with an interactive product preview
  that looks like the relationship board.
- Lower sections cover workflow, use cases, current product capabilities, and a final CTA.
- Narrow screens stack the story vertically while preserving the staircase and note-card motif.

## Code

- Main component: [`LandingPage.tsx`](../../src/LandingPage.tsx)
- Stylesheet: [`landing.css`](../../src/styles/landing.css)
- App integration: [`App.tsx`](../../src/App.tsx)
