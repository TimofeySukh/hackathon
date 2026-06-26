# Landing Page

## Purpose

The landing page is the first product entry screen. It is intentionally limited to the
opening viewport while the page is rebuilt section by section.

## Behavior

- Root visits show the landing page.
- The "Open product" button switches to the board by setting `#board`.
- No lower landing sections exist yet.

## Design

- The desktop background uses a soft blue-white gradient.
- A diagonal, uneven staircase runs from the upper-left area toward the lower-right area,
  visually separating a lower-left triangle from an upper-right triangle. The separator
  uses the board bubble language: wide pale blue body, dark blue outline, and soft
  rounded bends.
- The upper-right triangle contains separate overlapping Trello-style note cards that
  explain the project idea. They are not wrapped in a board/list container.
- The lower-left triangle contains one standalone Trello-style product note with the CTA.

## Code

- Main component: [`LandingPage.tsx`](../../src/LandingPage.tsx)
- Stylesheet: [`landing.css`](../../src/styles/landing.css)
- App integration: [`App.tsx`](../../src/App.tsx)
