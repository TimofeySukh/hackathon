# Onboarding

## Purpose

Onboarding introduces first-time users to the actions that make the board valuable:
saving the graph with an account, adding people from LinkedIn profile links, and importing
the full LinkedIn archive.

## Behavior

- The guide appears after the graph and auth state have loaded.
- In production it is shown once per browser, tracked by `social-onboarding-done-v1` in
  `localStorage`; in development it reopens for signed-out visitors.
- The guide no longer teaches obvious canvas gestures such as pan, zoom, move, or resize.
- The first screen presents a setup checklist:
  - sign in to save the board across devices
  - add one person from a LinkedIn profile URL through Search
  - import the full LinkedIn archive
- The profile-link step opens Search with an example LinkedIn URL. Completing a profile or
  ZIP import still advances the guide through the existing `import` onboarding action.
- The archive-import step renders the full LinkedIn sync guide inline, including all four
  screenshot-backed steps from the Settings guide. Users can also open the same guide in
  Settings or upload the ZIP directly.
- The guide can be dismissed with `Not now` and completed with `Done`.

## Design

The guide follows the global Material 3 direction in [`../DESIGN_SYSTEM.md`](../DESIGN_SYSTEM.md).

- Surfaces / elevation used: `--md-surface-container-high` with `--md-elev-2`.
- Components used: guide rail, checklist task buttons, text buttons, primary button, and
  screenshot-backed guide steps.
- Color roles used: primary for step indexes and primary actions, secondary container for
  hover state layers, primary container for signed-in/save status and archive note.
- Feature-specific layout: desktop uses a left-side guide rail so it reads as product
  guidance instead of a bottom popup; mobile uses a bottom sheet with dynamic offset above
  inspector/style sheets.
- Known gaps vs. the Material 3 target: the component still lives close to `App.tsx`
  state and should move into a feature folder if onboarding grows.

## Code

- Main file(s): `src/Onboarding.tsx`, `src/onboardingSteps.ts`, `src/styles/widgets.css`.
- Shared guide data: `src/linkedinGuideSteps.ts`.
- Key functions / components: `OnboardingCoach`, `notifyOnboarding`, `finishOnboarding`.
- Related state / hooks: `onboardingStep`, `onboardingCelebrating`, `onboardingOffset`,
  `ONBOARDING_STORAGE_KEY`.

## Open questions / TODO

- Decide whether future account completion should auto-advance the guide after sign-in, or
  remain a visible checklist item only.
