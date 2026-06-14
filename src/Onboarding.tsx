// A short, gesture-driven onboarding tour. Each instructional step names one
// action; when the user actually performs it on the board the tour advances by
// itself (see notifyOnboarding in App.tsx), so it never feels like a wall of
// modal dialogs. Step data + types live in ./onboardingSteps.
import {
  ONBOARDING_STEPS,
  ONBOARDING_DONE_STEP,
  ONBOARDING_PROGRESS_STEPS,
} from './onboardingSteps'

type OnboardingCoachProps = {
  step: number
  // While true, the card swaps to a brief "Great!" beat before advancing.
  celebrating: boolean
  onNext: () => void
  onBack: () => void
  onSkip: () => void
  onOpenSearch: () => void
}

export function OnboardingCoach({ step, celebrating, onNext, onBack, onSkip, onOpenSearch }: OnboardingCoachProps) {
  const current = ONBOARDING_STEPS[step]
  if (!current) return null

  if (celebrating) {
    return (
      <div className="onboarding-coach onboarding-coach--cheer" role="status" aria-live="polite">
        <span className="onboarding-coach__cheer-check" aria-hidden="true">✓</span>
        <strong className="onboarding-coach__cheer-text">Great!</strong>
      </div>
    )
  }

  const isDone = step === ONBOARDING_DONE_STEP
  const showProgress = ONBOARDING_PROGRESS_STEPS.includes(step)
  const canGoBack = step > 0 && step < ONBOARDING_DONE_STEP

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
            {ONBOARDING_PROGRESS_STEPS.map((i) => (
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
          {canGoBack && (
            <button type="button" className="onboarding-coach__back" onClick={onBack}>
              ← Back
            </button>
          )}
          {!isDone && step > 0 && (
            <button type="button" className="onboarding-coach__skip" onClick={onNext}>
              Next
            </button>
          )}
          {renderPrimary()}
        </div>
      </div>
    </div>
  )
}
