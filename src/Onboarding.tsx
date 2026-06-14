// A short, gesture-driven onboarding tour. Each instructional step names one
// action; when the user actually performs it on the board the tour advances by
// itself (see notifyOnboarding in App.tsx), so it never feels like a wall of
// modal dialogs. Steps stay deliberately terse: pan/zoom, resize, create, and
// importing real people — the handful of moves that aren't self-evident.

// The action a step listens for. `null` steps (welcome, done) only advance via
// their own buttons.
export type OnboardingAction = 'move' | 'resize' | 'create' | 'import'

export type OnboardingStep = {
  // Matched against notifyOnboarding(action) to auto-advance. null = manual only.
  trigger: OnboardingAction | null
  eyebrow?: string
  title: string
  body: string
  // Optional inline call-to-action (e.g. open the search box) shown as the
  // primary button. Steps with a trigger still auto-advance once the action
  // happens regardless of whether this button was used.
  cta?: 'start' | 'open-search' | 'finish' | 'done'
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    trigger: null,
    eyebrow: 'Welcome',
    title: 'Map your network 👋',
    body: 'A quick hands-on tour — four gestures, about half a minute. Do each one and it moves on by itself.',
    cta: 'start',
  },
  {
    trigger: 'move',
    eyebrow: 'Step 1 of 4',
    title: 'Move around',
    body: 'Drag empty space to pan, scroll or pinch to zoom. Drag any circle or person to reposition it. Give it a try →',
  },
  {
    trigger: 'resize',
    eyebrow: 'Step 2 of 4',
    title: 'Resize a circle',
    body: 'Grab a circle’s edge and drag to grow or shrink it. Its center moves the whole group; its edge resizes it.',
  },
  {
    trigger: 'create',
    eyebrow: 'Step 3 of 4',
    title: 'Add something',
    body: 'Double-click empty space to drop a person. Right-click a circle — or drag out from its center — to add a person or a nested circle.',
  },
  {
    trigger: 'import',
    eyebrow: 'Step 4 of 4',
    title: 'Bring in real people',
    body: 'Paste a LinkedIn profile URL into Search to import a contact — or add everyone at once with Settings → Import LinkedIn ZIP.',
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
const PROGRESS_STEPS = ONBOARDING_STEPS.map((_, i) => i).filter(
  (i) => i !== 0 && i !== ONBOARDING_DONE_STEP,
)

type OnboardingCoachProps = {
  step: number
  onNext: () => void
  onSkip: () => void
  onOpenSearch: () => void
}

export function OnboardingCoach({ step, onNext, onSkip, onOpenSearch }: OnboardingCoachProps) {
  const current = ONBOARDING_STEPS[step]
  if (!current) return null

  const isDone = step === ONBOARDING_DONE_STEP
  const showProgress = PROGRESS_STEPS.includes(step)

  function renderPrimary() {
    switch (current.cta) {
      case 'start':
        return (
          <button type="button" className="onboarding-coach__primary" onClick={onNext}>
            Start tour
          </button>
        )
      case 'open-search':
        return (
          <button type="button" className="onboarding-coach__primary" onClick={onOpenSearch}>
            Open search
          </button>
        )
      case 'finish':
      case 'done':
        return (
          <button type="button" className="onboarding-coach__primary" onClick={onNext}>
            Done
          </button>
        )
      default:
        return null
    }
  }

  return (
    <div className="onboarding-coach" role="dialog" aria-label="Getting started" aria-live="polite">
      <button
        type="button"
        className="onboarding-coach__close"
        aria-label="Dismiss tour"
        onClick={onSkip}
      >
        ×
      </button>
      {current.eyebrow && <span className="onboarding-coach__eyebrow">{current.eyebrow}</span>}
      <strong className="onboarding-coach__title">{current.title}</strong>
      <p className="onboarding-coach__body">{current.body}</p>

      <div className="onboarding-coach__footer">
        {showProgress ? (
          <div className="onboarding-coach__dots" aria-hidden="true">
            {PROGRESS_STEPS.map((i) => (
              <span
                key={i}
                className={`onboarding-coach__dot ${i === step ? 'is-active' : ''} ${i < step ? 'is-done' : ''}`}
              />
            ))}
          </div>
        ) : (
          <span />
        )}
        <div className="onboarding-coach__actions">
          {!isDone && (
            <button type="button" className="onboarding-coach__skip" onClick={onSkip}>
              Skip tour
            </button>
          )}
          {renderPrimary()}
        </div>
      </div>
    </div>
  )
}
