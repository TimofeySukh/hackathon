export type OnboardingSurface = 'desktop' | 'mobile'
export type OnboardingAction =
  | 'mode'
  | 'navigate'
  | 'create-person'
  | 'create-circle'
  | 'organize'
  | 'select'
  | 'search-import'
  | 'settings'
  | 'linkedin-guide'

export type OnboardingStep = {
  trigger: OnboardingAction
  eyebrow: string
  title: string
  body: string
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
    body: 'Open Search and choose a demo profile. The inspector shows that each person can carry a note and a connection.',
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
    trigger: 'mode',
    eyebrow: 'Board basics',
    title: 'Use the mobile modes',
    body: 'Use the three buttons at the top-left: Edit changes nodes, Select draws a selection box, and Pan moves the canvas with one finger.',
  },
  {
    trigger: 'navigate',
    eyebrow: 'Move and zoom',
    title: 'Explore the demo map',
    body: 'This temporary board shows OpenAI, Anthropic, and Google. Switch to Pan for one-finger panning, then pinch with two fingers to zoom.',
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
    body: 'Switch to Select mode, then drag across the board to select people and circles in that area.',
  },
  {
    trigger: 'search-import',
    eyebrow: 'Search',
    title: 'Find a demo person',
    body: 'Open Search and choose a demo profile. The inspector shows that each person can carry a note and a connection.',
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
    body: 'Inside Settings, tap the question mark next to LinkedIn Data Import. When you finish, the demo data is removed and your real board is restored.',
  },
]

export function getOnboardingSteps(surface: OnboardingSurface): OnboardingStep[] {
  return surface === 'mobile' ? MOBILE_ONBOARDING_STEPS : DESKTOP_ONBOARDING_STEPS
}
