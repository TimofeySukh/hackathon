// Step data + types for the onboarding tour. Kept in a plain module (not the
// .tsx) so the component file can export only its component — required for
// React Fast Refresh.

// The action a step listens for. `null` steps (welcome, done) only advance via
// their own buttons.
export type OnboardingAction = 'pan' | 'move' | 'resize' | 'create' | 'import'

export type OnboardingStep = {
  // Matched against notifyOnboarding(action) to auto-advance. null = manual only.
  trigger: OnboardingAction | null
  eyebrow?: string
  title: string
  body: string
  // Optional inline call-to-action shown as the primary button. Steps with a
  // trigger still auto-advance once the action happens, button used or not.
  cta?: 'start' | 'open-search' | 'finish' | 'done'
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    trigger: null,
    eyebrow: 'Welcome',
    title: 'Map your network 👋',
    body: 'A quick hands-on tour — five gestures, about half a minute. Do each one and it moves on by itself.',
    cta: 'start',
  },
  {
    trigger: 'pan',
    eyebrow: 'Step 1 of 5',
    title: 'Move around',
    body: 'Drag empty space to pan the canvas, or scroll/pinch to zoom. Give it a try →',
  },
  {
    trigger: 'move',
    eyebrow: 'Step 2 of 5',
    title: 'Move people or circles',
    body: 'Drag any circle or person to reposition it on the board.',
  },
  {
    trigger: 'resize',
    eyebrow: 'Step 3 of 5',
    title: 'Resize a circle',
    body: 'Grab a circle’s edge and drag to grow or shrink it. Its center moves the whole group; its edge resizes it.',
  },
  {
    trigger: 'create',
    eyebrow: 'Step 4 of 5',
    title: 'Add something',
    body: 'Double-click empty space to drop a person. Right-click a circle — or drag out from its center — to add a person or a nested circle.',
  },
  {
    trigger: 'import',
    eyebrow: 'Step 5 of 5',
    title: 'Bring in real people',
    body: 'Paste a LinkedIn profile URL into Search to import a contact. Try importing one of the creators: www.linkedin.com/in/velizar-seleznev or www.linkedin.com/in/timofey-sukhov-775b38404/',
    cta: 'open-search',
  },
  {
    trigger: null,
    eyebrow: 'All set',
    title: 'You’re ready 🎉',
    body: 'That’s the whole map — your board saves automatically as you build it.',
    cta: 'done',
  },
]

// Index of the closing "all set" card.
export const ONBOARDING_DONE_STEP = ONBOARDING_STEPS.length - 1

// The instructional steps that get a progress dot (excludes welcome + done).
export const ONBOARDING_PROGRESS_STEPS = ONBOARDING_STEPS.map((_, i) => i).filter(
  (i) => i !== 0 && i !== ONBOARDING_DONE_STEP,
)
