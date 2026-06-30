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
  layout?: 'overview' | 'linkedin-guide'
  // Optional inline call-to-action shown as the primary button.
  cta?: 'start' | 'open-signin' | 'try-profile-link' | 'import-zip' | 'done'
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    trigger: null,
    eyebrow: 'Start here',
    title: 'Build your real network',
    body: 'The board is useful once it has real people. Save it with an account, add one person from a LinkedIn profile link, or import your full LinkedIn archive.',
    layout: 'overview',
    cta: 'start',
  },
  {
    trigger: 'import',
    eyebrow: 'Step 1 of 2',
    title: 'Add people by profile link',
    body: 'Paste a LinkedIn profile URL into Search. DataNode turns it into a person, company circle, notes, and a saved profile link.',
    cta: 'try-profile-link',
  },
  {
    trigger: null,
    eyebrow: 'Step 2 of 2',
    title: 'Import your LinkedIn archive',
    body: 'For the full graph, request your LinkedIn data archive and upload the ZIP here. The complete guide is shown below so it is not hidden in Settings.',
    layout: 'linkedin-guide',
    cta: 'import-zip',
  },
  {
    trigger: null,
    eyebrow: 'All set',
    title: 'You are ready',
    body: 'Keep adding people from profile links or import the archive when LinkedIn emails it to you. Signed-in boards save automatically.',
    cta: 'done',
  },
]

// Index of the closing "all set" card.
export const ONBOARDING_DONE_STEP = ONBOARDING_STEPS.length - 1

// The instructional steps that get a progress dot (excludes welcome + done).
export const ONBOARDING_PROGRESS_STEPS = ONBOARDING_STEPS.map((_, i) => i).filter(
  (i) => i !== 0 && i !== ONBOARDING_DONE_STEP,
)
