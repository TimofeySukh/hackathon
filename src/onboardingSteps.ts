export type OnboardingSurface = 'desktop' | 'mobile'

export type OnboardingStep = {
  eyebrow: string
  title: string
  body: string
}

const DESKTOP_ONBOARDING_STEPS: OnboardingStep[] = [
  {
    eyebrow: 'Board basics',
    title: 'Move around the map',
    body: 'Drag empty space to pan. Use the mouse wheel, trackpad scroll, or trackpad pinch to zoom in and out.',
  },
  {
    eyebrow: 'Create',
    title: 'Add people and circles',
    body: 'Right-click a circle to add a person or another circle. Double-click empty space to add a person at that point.',
  },
  {
    eyebrow: 'Organize',
    title: 'Move and resize zones',
    body: 'Drag a person or circle to move it. Drag a circle edge to resize the zone around the people inside it.',
  },
  {
    eyebrow: 'Select',
    title: 'Select an area',
    body: 'Right-drag empty space to draw a selection box. Hold Shift while clicking to add or remove individual people and circles.',
  },
  {
    eyebrow: 'Import',
    title: 'Bring in real people',
    body: 'Open Settings to import a LinkedIn ZIP, or paste a LinkedIn profile URL into Search to add one person.',
  },
]

const MOBILE_ONBOARDING_STEPS: OnboardingStep[] = [
  {
    eyebrow: 'Board basics',
    title: 'Use the mobile modes',
    body: 'Use the three buttons at the top-left: Edit changes nodes, Select draws a selection box, and Pan moves the canvas with one finger.',
  },
  {
    eyebrow: 'Move and zoom',
    title: 'Pan and zoom with touch',
    body: 'Switch to Pan for one-finger panning. Pinch with two fingers anywhere on the board to zoom in and out.',
  },
  {
    eyebrow: 'Create',
    title: 'Add people and circles',
    body: 'In Edit mode, double-tap empty space to add a person. Tap a circle center and drag outward to open creation options.',
  },
  {
    eyebrow: 'Select',
    title: 'Select a zone',
    body: 'Switch to Select mode, then drag across the board to select people and circles in that area.',
  },
  {
    eyebrow: 'Import',
    title: 'Bring in real people',
    body: 'Open Settings to import a LinkedIn ZIP, or paste a LinkedIn profile URL into Search to add one person.',
  },
]

export function getOnboardingSteps(surface: OnboardingSurface): OnboardingStep[] {
  return surface === 'mobile' ? MOBILE_ONBOARDING_STEPS : DESKTOP_ONBOARDING_STEPS
}
