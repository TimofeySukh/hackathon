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
    title: 'Move around the map',
    body: 'Drag empty space to pan. Use the mouse wheel, trackpad scroll, or trackpad pinch to zoom in and out.',
  },
  {
    trigger: 'create-person',
    eyebrow: 'Create',
    title: 'Add a person with a double-click',
    body: 'Double-click empty space on the board to drop a person at that point.',
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
    body: 'Drag a person or circle to move it. Drag a circle edge to resize the zone around the people inside it.',
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
    title: 'Add someone from LinkedIn',
    body: 'Open Search and choose one of the LinkedIn examples. A profile link can add a real person to the board.',
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
    body: 'Inside Settings, click the question mark next to LinkedIn Data Import to see how to request and upload your archive.',
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
    title: 'Pan and zoom with touch',
    body: 'Switch to Pan for one-finger panning. Pinch with two fingers anywhere on the board to zoom in and out.',
  },
  {
    trigger: 'create-person',
    eyebrow: 'Create',
    title: 'Add a person with a double-tap',
    body: 'In Edit mode, double-tap empty space on the board to drop a person at that point.',
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
    title: 'Add someone from LinkedIn',
    body: 'Open Search and choose one of the LinkedIn examples. A profile link can add a real person to the board.',
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
    body: 'Inside Settings, tap the question mark next to LinkedIn Data Import to see how to request and upload your archive.',
  },
]

export function getOnboardingSteps(surface: OnboardingSurface): OnboardingStep[] {
  return surface === 'mobile' ? MOBILE_ONBOARDING_STEPS : DESKTOP_ONBOARDING_STEPS
}
