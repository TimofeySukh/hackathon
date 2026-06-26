# Landing Page

## Purpose

The landing page is the first product entry screen. It is intentionally limited to the
opening viewport while the page is rebuilt section by section.

## Behavior

- Root visits show the landing page.
- The "Open product" button switches to the board by setting `#board`.
- No lower landing sections exist yet.

## Design

- The background uses a soft blue-white Material 3-tonal gradient with a subtle dotted
  board texture.
- A diagonal, uneven staircase runs from the upper-left area toward the lower-right area,
  visually separating a lower-left triangle from an upper-right triangle. The separator
  uses the board bubble language: wide pale blue body, dark blue outline, and soft
  rounded bends.
- The upper-right triangle contains separate overlapping Trello-style note cards for the
  product workflow: import people, think visually, and use AI memory. They are not wrapped
  in a board/list container.
- The lower-left triangle contains one standalone Trello-style hero note with the product
  promise, concise supporting copy, three proof chips, and one primary CTA. On narrow
  screens, the notes compress into the top of the same opening viewport and the hero note
  stays below them.

## Code

- Main component: [`LandingPage.tsx`](../../src/LandingPage.tsx)
- Stylesheet: [`landing.css`](../../src/styles/landing.css)
- App integration: [`App.tsx`](../../src/App.tsx)
