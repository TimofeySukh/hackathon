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
- The setup panel is a single screen, not a step-by-step tour.
- The top of the panel shows the account save action. Signed-out users get a prominent
  `Sign in` button; signed-in users see a saved status.
- The next section shows that people can be added from a LinkedIn profile URL and opens
  Search with an example URL.
- The archive section renders the full LinkedIn sync guide inline, including all four
  screenshot-backed steps from the Settings guide. Users can also open the same guide in
  Settings or upload the ZIP directly.
- Completing a profile or ZIP import still advances the guide through the existing
  `import` onboarding action.
- The guide can be dismissed with `Not now`.

## Design

The guide follows the global Material 3 direction in [`../DESIGN_SYSTEM.md`](../DESIGN_SYSTEM.md).

- Surfaces / elevation used: desktop uses a docked side sheet on `--md-surface` with a
  subtle right divider and `--md-elev-1`; mobile uses a full-screen setup sheet.
- Components used: side sheet, section actions, text buttons, primary buttons, status chip,
  and screenshot-backed guide steps.
- Color roles used: primary for actions and guide indexes, primary container for the account
  save section, surface containers for guide step items.
- Feature-specific layout: the panel is docked to the app edge so it reads as a first-run
  workspace setup surface instead of a dismissible popup. The full LinkedIn guide is visible
  in the same scroll surface.
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
