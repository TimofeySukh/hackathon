import { getOnboardingSteps, type OnboardingSurface } from './onboardingSteps'

type OnboardingCoachProps = {
  surface: OnboardingSurface
  step: number
  onNext: () => void
  onBack: () => void
  onSkip: () => void
}

export function OnboardingCoach({ surface, step, onNext, onBack, onSkip }: OnboardingCoachProps) {
  const steps = getOnboardingSteps(surface)
  const current = steps[step]
  if (!current) return null

  const isLast = step === steps.length - 1

  return (
    <section
      className={`onboarding-coach onboarding-coach--${surface}`}
      aria-label="Board guide"
      aria-live="polite"
    >
      <button
        type="button"
        className="onboarding-coach__close"
        aria-label="Dismiss guide"
        onClick={onSkip}
      >
        x
      </button>
      <span className="onboarding-coach__eyebrow">{current.eyebrow}</span>
      <h2 className="onboarding-coach__title">{current.title}</h2>
      <p className="onboarding-coach__body">{current.body}</p>
      <div className="onboarding-coach__footer">
        <div className="onboarding-coach__dots" aria-label={`Step ${step + 1} of ${steps.length}`}>
          {steps.map((item, index) => (
            <span
              key={item.title}
              className={`onboarding-coach__dot ${index === step ? 'is-active' : ''} ${index < step ? 'is-done' : ''}`}
            />
          ))}
        </div>
        <div className="onboarding-coach__actions">
          {step > 0 && (
            <button type="button" className="onboarding-coach__secondary" onClick={onBack}>
              Back
            </button>
          )}
          <button type="button" className="onboarding-coach__primary" onClick={onNext}>
            {isLast ? 'Done' : 'Skip'}
          </button>
        </div>
      </div>
    </section>
  )
}
