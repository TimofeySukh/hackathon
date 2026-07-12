# Board onboarding

## Purpose

Help new users understand the board controls before they start building a graph. The
guide temporarily replaces the visible board with a demo graph matching the landing
screenshot, so users learn against meaningful data before returning to their real board.
It focuses on the actions that were least discoverable in user testing: zooming, panning,
creating people and circles, moving/resizing zones, selecting an area, adding a LinkedIn
  profile from Search, opening Settings, and finding the LinkedIn archive sync guide.

## Behavior

- The board opens a short guide the first time a browser visits `#board`.
- Landing page board CTAs force-open the guide for that board launch, even if the browser
  has seen it before.
- A Help button in the board toolbar reopens the guide for signed-out/local users.
  Signed-in users do not see this toolbar Help button.
- Completion is stored locally under `social-board-onboarding-done-v3`.
- While the guide is open, the app shows a temporary, non-persisted graph with `You`,
  OpenAI, Anthropic, and Google circles. The people match the landing screenshot:
  Ilya Sutskever, Jakub Pachocki, Greg Brockman, Wojciech Zaremba, Sam Altman, Jared
  Kaplan, Tom Brown, Dario Amodei, Daniela Amodei, Jack Clark, Sergey Brin, Demis
  Hassabis, Larry Page, Jeff Dean, and Sundar Pichai.
- Each demo person has a role note and one profile connection so the inspector teaches
  real person-card structure.
- Autosave/IndexedDB persistence ignores the temporary demo graph. Finishing or
  dismissing onboarding restores the user's previous saved/local graph, clears demo data,
  and shows the success notice "You successfully completed onboarding. Demo data has been
  removed."
- The guide has separate copy for desktop and touch layouts:
  - Desktop explains direct mouse/trackpad controls: drag empty space, wheel/trackpad
    zoom, double-click person creation, center-drag circle creation, and right-drag area
    selection.
  - Mobile explains direct touch controls: drag empty space to pan, drag a node to move
    it, pinch to zoom, and hold empty space before dragging to select an area.
- Each step turns into a blue completed state with a checkmark for one second when the
  matching action is performed, then auto-advances. The visible `Skip` button is only a
  manual bypass for users who already know that control.
- The Search flow is split into two steps: first choose a demo person already on the board,
  then add someone with a LinkedIn profile link. Empty Search shows demo people on the
  first step and Timofey Sukhov / Velizar Seleznev LinkedIn examples on the second.
- The archive-import education is split into two explicit actions: open Settings with the
  gear, then click the `?` next to LinkedIn Data Import. On mobile the final step shows a
  red notice that LinkedIn archive requests require a computer; users finish with `Done`
  instead of opening the desktop-only sync guide.
- Action triggers are `navigate`, `create-person`, `create-circle`, `organize`,
  `select`, `search-import`, `linkedin-import`, `settings`, and `linkedin-guide`.
- The create flow is split into two verified steps: double-click/double-tap empty space to
  add a person, then drag from a circle center to empty space and choose Add circle.

## Design

- The guide is a compact Material 3 floating coach card on desktop.
- On touch/mobile it behaves like a bottom sheet when the board is unobstructed. Opening
  a top-level workspace panel (Settings, Search, inspector, create actions, multi-select
  actions, Agent settings, or LinkedIn guide) hides the coach instead of stacking it over
  that panel. Closing the workspace panel restores the coach at its current step.
- The guide uses local progress dots, a dismiss button, and `Back` / `Skip` / `Done`
  actions. It does not block board interaction outside the card.

## Code

- Main component: [`../../src/Onboarding.tsx`](../../src/Onboarding.tsx)
- Step copy: [`../../src/onboardingSteps.ts`](../../src/onboardingSteps.ts)
- Demo graph: [`../../src/lib/onboardingDemoGraph.ts`](../../src/lib/onboardingDemoGraph.ts)
- Board integration: [`../../src/App.tsx`](../../src/App.tsx)
- Styles: [`../../src/styles/widgets.css`](../../src/styles/widgets.css)

## Open questions / TODO

- Consider adding lightweight visual anchors from guide steps to the exact toolbar or
  canvas affordance if future recordings still show users missing a control.
