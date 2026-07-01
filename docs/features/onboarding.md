# Board onboarding

## Purpose

Help new users understand the board controls before they start building a graph. The
guide focuses on the actions that were least discoverable in user testing: zooming,
panning, creating circles, moving/resizing zones, and selecting an area.

## Behavior

- The board opens a short guide the first time a browser visits `#board`.
- Landing page board CTAs force-open the guide for that board launch, even if the browser
  has seen it before.
- A Help button in the board toolbar reopens the guide at any time.
- Completion is stored locally under `social-board-onboarding-done-v2`.
- The guide has separate copy for desktop and touch layouts:
  - Desktop explains direct mouse/trackpad controls: drag empty space, wheel/trackpad
    zoom, right-click circle creation, double-click person creation, and right-drag area
    selection.
  - Mobile explains the top-left modes: Edit, Select, and Pan, plus two-finger pinch zoom.

## Design

- The guide is a compact Material 3 floating coach card on desktop.
- On touch/mobile it behaves like a bottom sheet so it stays clear of the top toolbar and
  mode buttons.
- The guide uses local progress dots, a dismiss button, and `Back` / `Next` / `Done`
  actions. It does not block board interaction outside the card.

## Code

- Main component: [`../../src/Onboarding.tsx`](../../src/Onboarding.tsx)
- Step copy: [`../../src/onboardingSteps.ts`](../../src/onboardingSteps.ts)
- Board integration: [`../../src/App.tsx`](../../src/App.tsx)
- Styles: [`../../src/styles/widgets.css`](../../src/styles/widgets.css)

## Open questions / TODO

- Consider adding lightweight visual anchors from guide steps to the exact toolbar or
  canvas affordance if future recordings still show users missing a control.
