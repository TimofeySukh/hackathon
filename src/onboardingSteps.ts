// Step data + types for the onboarding tour. Kept in a plain module (not the
// .tsx) so the component file can export only its component — required for
// React Fast Refresh.

// The action a step listens for. `null` steps only advance via their own buttons.
export type OnboardingAction = 'pan' | 'move' | 'resize' | 'create' | 'import'

export type OnboardingStep = {
  // Matched against notifyOnboarding(action) to auto-advance. null = manual only.
  trigger: OnboardingAction | null
  eyebrow?: string
  title: string
  body: string
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    trigger: null,
    eyebrow: 'Getting started',
    title: 'Make the board useful',
    body: 'Start with the actions that matter: save your graph, add people by LinkedIn profile link, or import your full LinkedIn archive.',
  },
  {
    trigger: null,
    eyebrow: 'All set',
    title: 'You are ready',
    body: 'Keep adding people from profile links or import the archive when LinkedIn emails it to you. Signed-in boards save automatically.',
  },
]

// Index of the closing "all set" card.
export const ONBOARDING_DONE_STEP = ONBOARDING_STEPS.length - 1

export const ONBOARDING_PROGRESS_STEPS: number[] = []
