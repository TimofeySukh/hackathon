# Board progressive hints

## Purpose

Help new users discover the board controls without blocking the canvas or replacing their
real graph. Hints are small affordances in the layout: unfinished hints are quiet gray
text, completed hints flash in the primary color, then disappear.

The hints focus on the actions that are easiest to miss: panning, creating people and
circles, selecting areas, Search, LinkedIn profile import, Settings, and the LinkedIn
archive sync guide.

## Behavior

- The board opens directly on the user's real saved/local graph. There is no temporary
  demo graph and no forced first-run modal or coach card.
- Hint completion is stored locally under `social-board-progressive-hints-done-v1`.
- Triggered hints flash in the Material 3 primary color for about 850ms, then are marked
  complete and removed from the list.
- Desktop shows up to five unfinished hints in a narrow column in the bottom-left corner.
- Touch/mobile layouts show only the next unfinished hint as a compact row below the top
  toolbar. The desktop hint column is not reused on phones.
- The toolbar Help button for signed-out/local users resets the completed hint list so
  users can see the progressive hints again. It does not open a tour or replace graph
  data.
- Search opening completes the Search hint. Selecting a search result still completes the
  same hint for users who use keyboard shortcuts or arrive while Search is already open.
- LinkedIn archive education remains in Settings: the `?` next to LinkedIn Data Import
  opens the guide on desktop. On phone-sized viewports, it shows the desktop requirement
  message and completes the relevant hint.
- Action triggers are `mode`, `navigate`, `create-person`, `create-circle`, `organize`,
  `select`, `search-import`, `linkedin-import`, `settings`, and `linkedin-guide`.

## Design

- Progressive hints are not cards, modals, sheets, or a slideshow. They have no dots,
  Skip, Done, or Back controls.
- Desktop hints sit in the bottom-left corner so they do not cover Search, Settings, or the
  inspector.
- Mobile shows one hint because the left rail, toolbar, and bottom panels already compete
  for space.
- Hints are allowed to disappear after completion. The Help button is the recovery path.

## Code

- Main component: [`../../src/Onboarding.tsx`](../../src/Onboarding.tsx)
- Hint data: [`../../src/onboardingSteps.ts`](../../src/onboardingSteps.ts)
- Board integration: [`../../src/App.tsx`](../../src/App.tsx)
- Styles: [`../../src/styles/widgets.css`](../../src/styles/widgets.css)

## Open Questions / TODO

- Consider adding a Help menu section that lists all completed and remaining hints without
  resetting completion state.
