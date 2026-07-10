export type OnboardingSurface = 'desktop' | 'mobile'
export type OnboardingAction =
  | 'navigate'
  | 'create-person'
  | 'create-circle'
  | 'organize'
  | 'select'
  | 'search-import'
  | 'linkedin-import'
  | 'settings'
  | 'linkedin-guide'

export type OnboardingStep = {
  trigger: OnboardingAction
  eyebrow: string
  title: string
  body: string
  /** Shown at the top of the coach on mobile when the step cannot fully run on a phone. */
  mobileNotice?: string
}

const DESKTOP_ONBOARDING_STEPS: OnboardingStep[] = [
  {
    trigger: 'navigate',
    eyebrow: 'Board basics',
    title: 'Explore the demo map',
    body: 'This temporary board shows OpenAI, Anthropic, and Google. Drag empty space to pan, then zoom with the mouse wheel, trackpad scroll, or trackpad pinch.',
  },
  {
    trigger: 'create-person',
    eyebrow: 'Create',
    title: 'Add a person to the demo',
    body: 'Double-click empty space near the demo companies to drop a temporary person at that point.',
  },
  {
    trigger: 'create-circle',
    eyebrow: 'Create',
    title: 'Add a circle from the center',
    body: 'Drag from a circle center to empty space, then choose Add circle in the menu.',
  },
  {
    trigger: 'organize',
    eyebrow: 'Organize',
    title: 'Move and resize zones',
    body: 'Drag a demo person or company circle to move it. Drag a circle edge to resize the zone around the people inside it.',
  },
  {
    trigger: 'select',
    eyebrow: 'Select',
    title: 'Select an area',
    body: 'Right-drag empty space to draw a selection box. Hold Shift while clicking to add or remove individual people and circles.',
  },
  {
    trigger: 'search-import',
    eyebrow: 'Search',
    title: 'Find a demo person',
    body: 'Open Search and choose someone already on the demo board. The inspector shows that each person can carry a note and a connection.',
  },
  {
    trigger: 'linkedin-import',
    eyebrow: 'Search',
    title: 'Add someone from LinkedIn',
    body: 'You can also use Search to add people with a LinkedIn profile link. Choose one of the examples or paste a URL.',
  },
  {
    trigger: 'settings',
    eyebrow: 'Settings',
    title: 'Open Settings',
    body: 'Click the gear icon to open Settings. This is where imports, account controls, and graph actions live.',
  },
  {
    trigger: 'linkedin-guide',
    eyebrow: 'LinkedIn archive',
    title: 'Find the sync guide',
    body: 'Inside Settings, click the question mark next to LinkedIn Data Import. When you finish, the demo data is removed and your real board is restored.',
  },
]

const MOBILE_ONBOARDING_STEPS: OnboardingStep[] = [
  {
    trigger: 'navigate',
    eyebrow: 'Move and zoom',
    title: 'Explore the demo map',
    body: 'This temporary board shows OpenAI, Anthropic, and Google. Drag empty space to move around, drag a person or circle to move it, and pinch with two fingers to zoom.',
  },
  {
    trigger: 'create-person',
    eyebrow: 'Create',
    title: 'Add a person to the demo',
    body: 'In Edit mode, double-tap empty space near the demo companies to drop a temporary person at that point.',
  },
  {
    trigger: 'create-circle',
    eyebrow: 'Create',
    title: 'Add a circle from the center',
    body: 'In Edit mode, drag from a circle center to empty space, then choose Add circle in the menu.',
  },
  {
    trigger: 'select',
    eyebrow: 'Select',
    title: 'Select a zone',
    body: 'Touch and hold empty space, then drag across the board to select people and circles in that area.',
  },
  {
    trigger: 'search-import',
    eyebrow: 'Search',
    title: 'Find a demo person',
    body: 'Open Search and choose someone already on the demo board. The inspector shows that each person can carry a note and a connection.',
  },
  {
    trigger: 'linkedin-import',
    eyebrow: 'Search',
    title: 'Add someone from LinkedIn',
    body: 'You can also use Search to add people with a LinkedIn profile link. Choose one of the examples or paste a URL.',
  },
  {
    trigger: 'settings',
    eyebrow: 'Settings',
    title: 'Open Settings',
    body: 'Tap the gear icon to open Settings. This is where imports, account controls, and graph actions live.',
  },
  {
    trigger: 'linkedin-guide',
    eyebrow: 'LinkedIn archive',
    title: 'Find the sync guide',
    mobileNotice:
      'Sorry — LinkedIn only lets you request a data archive from a computer. Do that on desktop, then come back here to import the ZIP.',
    body: 'On a computer, open Settings and tap the question mark next to LinkedIn Data Import for step-by-step instructions. Tap Done below to finish onboarding and restore your real board.',
  },
]

export function getOnboardingSteps(surface: OnboardingSurface): OnboardingStep[] {
  return surface === 'mobile' ? MOBILE_ONBOARDING_STEPS : DESKTOP_ONBOARDING_STEPS
}
