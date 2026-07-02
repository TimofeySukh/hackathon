import type { OnboardingHint, OnboardingSurface } from './onboardingSteps'

type ProgressiveHintsProps = {
  surface: OnboardingSurface
  hints: OnboardingHint[]
  completingHintIds: Set<string>
}

export function ProgressiveHints({ surface, hints, completingHintIds }: ProgressiveHintsProps) {
  if (hints.length === 0) return null

  return (
    <section
      className={`progressive-hints progressive-hints--${surface}`}
      aria-label="Board hints"
      aria-live="polite"
    >
      {hints.map((hint) => (
        <div
          key={hint.id}
          className={`progressive-hints__item ${completingHintIds.has(hint.id) ? 'is-complete' : ''}`}
        >
          {hint.text}
        </div>
      ))}
    </section>
  )
}
