import { getOnboardingSteps, type OnboardingSurface } from './onboardingSteps'

type OnboardingCoachProps = {
  surface: OnboardingSurface
  step: number
  completed: boolean
  onNext: () => void
  onBack: () => void
  onSkip: () => void
}

export function OnboardingCoach({ surface, step, completed, onNext, onBack, onSkip }: OnboardingCoachProps) {
  const steps = getOnboardingSteps(surface)
  const current = steps[step]
  if (!current) return null

  const isLast = step === steps.length - 1

  return (
    <section
      className={`onboarding-coach onboarding-coach--${surface} ${completed ? 'is-complete' : ''}`}
      aria-label="Board guide"
      aria-live="polite"
    >
      <button
        type="button"
        className="onboarding-coach__close"
        aria-label={completed ? 'Step completed' : 'Dismiss guide'}
        onClick={onSkip}
        disabled={completed}
      >
        {completed ? '✓' : 'x'}
      </button>
      {surface === 'mobile' && current.mobileNotice ? (
        <p className="onboarding-coach__mobile-notice" role="note">
          {current.mobileNotice}
        </p>
      ) : null}
      <div className="onboarding-coach__heading">
        <span>
          <span className="onboarding-coach__eyebrow">{current.eyebrow}</span>
          <h2 className="onboarding-coach__title">{current.title}</h2>
        </span>
      </div>
      <p className="onboarding-coach__body">{current.body}</p>
      <div className="onboarding-coach__footer">
        <div className="onboarding-coach__dots" aria-label={`Step ${step + 1} of ${steps.length}`}>
          {steps.map((item, index) => (
            <span
              key={item.title}
              className={`onboarding-coach__dot ${index === step ? 'is-active' : ''} ${index < step || (index === step && completed) ? 'is-done' : ''}`}
            />
          ))}
        </div>
        <div className="onboarding-coach__actions">
          {step > 0 && (
            <button type="button" className="onboarding-coach__secondary" onClick={onBack} disabled={completed}>
              Back
            </button>
          )}
          <button type="button" className="onboarding-coach__primary" onClick={onNext} disabled={completed}>
            {isLast ? 'Done' : 'Skip'}
          </button>
        </div>
      </div>
    </section>
  )
}
