// A product-first onboarding guide. It focuses on the durable setup actions that
// make the board useful: account save, adding people by LinkedIn link, and the
// full LinkedIn archive import guide. Step data + types live in ./onboardingSteps.
import {
  ONBOARDING_STEPS,
  ONBOARDING_DONE_STEP,
  ONBOARDING_PROGRESS_STEPS,
} from './onboardingSteps'
import { LINKEDIN_GUIDE_STEPS } from './linkedinGuideSteps'

const EXAMPLE_PROFILE_URL = 'www.linkedin.com/in/velizar-seleznev'

type OnboardingCoachProps = {
  step: number
  // While true, the card swaps to a brief "Great!" beat before advancing.
  celebrating: boolean
  onNext: () => void
  onBack: () => void
  onSkip: () => void
  onOpenSearch: (query?: string) => void
  onOpenSignIn: () => void
  onOpenLinkedInGuide: () => void
  onImportLinkedInZip: () => void
  isSignedIn: boolean
  offset?: number
}

export function OnboardingCoach({
  step,
  celebrating,
  onNext,
  onBack,
  onSkip,
  onOpenSearch,
  onOpenSignIn,
  onOpenLinkedInGuide,
  onImportLinkedInZip,
  isSignedIn,
  offset = 0,
}: OnboardingCoachProps) {
  const current = ONBOARDING_STEPS[step]
  if (!current) return null

  if (celebrating) {
    return (
      <div
        className="onboarding-coach onboarding-coach--cheer"
        role="status"
        aria-live="polite"
        style={offset > 0 ? { bottom: `${offset + 12}px` } : undefined}
      >
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
            Show me
          </button>
        )
      case 'open-signin':
        return (
          <button type="button" className="onboarding-coach__primary" onClick={onOpenSignIn}>
            Sign in
          </button>
        )
      case 'try-profile-link':
        return (
          <button type="button" className="onboarding-coach__primary" onClick={() => onOpenSearch(EXAMPLE_PROFILE_URL)}>
            Try profile link
          </button>
        )
      case 'import-zip':
        return (
          <button type="button" className="onboarding-coach__primary" onClick={onImportLinkedInZip}>
            Import LinkedIn ZIP
          </button>
        )
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

  function renderBodyText(text: string) {
    const urlPattern = /(https?:\/\/[^\s]+|www\.[^\s]+)/g
    const parts = text.split(urlPattern)
    return parts.map((part, index) => {
      if (urlPattern.test(part)) {
        const cleanUrl = part.replace(/[),.;]+$/, '')
        return (
          <button
            key={index}
            type="button"
            className="onboarding-coach__link-btn"
            onClick={() => onOpenSearch(cleanUrl)}
          >
            {part}
          </button>
        )
      }
      return part
    })
  }

  function renderOverview() {
    if (current.layout !== 'overview') return null
    return (
      <div className="onboarding-coach__overview">
        <button
          type="button"
          className={`onboarding-coach__task ${isSignedIn ? 'is-done' : ''}`}
          onClick={isSignedIn ? undefined : onOpenSignIn}
        >
          <span className="onboarding-coach__task-index">{isSignedIn ? '✓' : '1'}</span>
          <span>
            <strong>{isSignedIn ? 'Board is saved' : 'Sign in to save'}</strong>
            <small>{isSignedIn ? 'Your changes sync across devices.' : 'Keep local editing, but claim the graph before serious import.'}</small>
          </span>
        </button>
        <button
          type="button"
          className="onboarding-coach__task"
          onClick={() => onOpenSearch(EXAMPLE_PROFILE_URL)}
        >
          <span className="onboarding-coach__task-index">2</span>
          <span>
            <strong>Add one person by URL</strong>
            <small>Paste a LinkedIn profile link in Search to create a contact.</small>
          </span>
        </button>
        <button
          type="button"
          className="onboarding-coach__task"
          onClick={onNext}
        >
          <span className="onboarding-coach__task-index">3</span>
          <span>
            <strong>Import the archive</strong>
            <small>Use the full LinkedIn guide for a complete network import.</small>
          </span>
        </button>
      </div>
    )
  }

  function renderLinkedInGuide() {
    if (current.layout !== 'linkedin-guide') return null
    return (
      <div className="onboarding-coach__guide">
        <div className="onboarding-coach__guide-actions">
          <button type="button" className="onboarding-coach__primary onboarding-coach__primary--compact" onClick={onImportLinkedInZip}>
            Import LinkedIn ZIP
          </button>
          <button type="button" className="onboarding-coach__secondary" onClick={onOpenLinkedInGuide}>
            Open in Settings
          </button>
          <button type="button" className="onboarding-coach__secondary" onClick={() => onOpenSearch(EXAMPLE_PROFILE_URL)}>
            Add by link instead
          </button>
        </div>
        <div className="onboarding-coach__guide-steps">
          {LINKEDIN_GUIDE_STEPS.map((guideStep) => (
            <article key={guideStep.n} className="onboarding-coach__guide-step">
              <div className="onboarding-coach__guide-copy">
                <span className="onboarding-coach__guide-index">{guideStep.n}</span>
                <div>
                  <h3>{guideStep.title}</h3>
                  <p>{guideStep.body}</p>
                </div>
              </div>
              <img src={guideStep.img} alt={guideStep.title} />
            </article>
          ))}
        </div>
        <p className="onboarding-coach__note">
          Wait up to 24 hours. LinkedIn will email you when the archive is ready. Then come back and upload the ZIP.
        </p>
      </div>
    )
  }

  return (
    <div
      className="onboarding-coach"
      role="complementary"
      aria-label="Getting started"
      aria-live="polite"
      style={offset > 0 ? { bottom: `${offset + 12}px` } : undefined}
    >
      {current.eyebrow && <span className="onboarding-coach__eyebrow">{current.eyebrow}</span>}
      <strong className="onboarding-coach__title">{current.title}</strong>
      <p className="onboarding-coach__body">{renderBodyText(current.body)}</p>
      {renderOverview()}
      {renderLinkedInGuide()}

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
          {!isDone && (
            <button type="button" className="onboarding-coach__skip" onClick={onSkip}>
              Not now
            </button>
          )}
          {renderPrimary()}
        </div>
      </div>
    </div>
  )
}
