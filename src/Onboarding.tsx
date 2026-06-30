// First-run setup for the actions that make a blank board valuable: save the
// graph, add people from LinkedIn profile URLs, and import the LinkedIn archive.
import { LINKEDIN_GUIDE_STEPS } from './linkedinGuideSteps'
import { ONBOARDING_DONE_STEP, ONBOARDING_STEPS } from './onboardingSteps'

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
        <strong className="onboarding-coach__cheer-text">Added</strong>
      </div>
    )
  }

  const isDone = step === ONBOARDING_DONE_STEP

  if (isDone) {
    return (
      <aside
        className="onboarding-coach onboarding-coach--done"
        aria-label="Getting started complete"
        aria-live="polite"
        style={offset > 0 ? { bottom: `${offset + 12}px` } : undefined}
      >
        <span className="onboarding-coach__eyebrow">{current.eyebrow}</span>
        <strong className="onboarding-coach__title">{current.title}</strong>
        <p className="onboarding-coach__body">{current.body}</p>
        <div className="onboarding-coach__footer">
          <span />
          <button type="button" className="onboarding-coach__primary" onClick={onNext}>
            Done
          </button>
        </div>
      </aside>
    )
  }

  return (
    <aside
      className="onboarding-coach onboarding-coach--setup"
      aria-label="Getting started"
      aria-live="polite"
      style={offset > 0 ? { bottom: `${offset + 12}px` } : undefined}
    >
      <header className="onboarding-coach__header">
        <span className="onboarding-coach__eyebrow">{current.eyebrow}</span>
        <strong className="onboarding-coach__title">{current.title}</strong>
        <p className="onboarding-coach__body">{current.body}</p>
      </header>

      <section className="onboarding-coach__save">
        <div>
          <span className="onboarding-coach__section-kicker">Account</span>
          <h3>{isSignedIn ? 'Your board is saved' : 'Save the board before importing'}</h3>
          <p>
            {isSignedIn
              ? 'This graph syncs across devices as you add people.'
              : 'Anonymous boards stay in this browser. Sign in before importing a large archive.'}
          </p>
        </div>
        {isSignedIn ? (
          <span className="onboarding-coach__status">Signed in</span>
        ) : (
          <button type="button" className="onboarding-coach__primary" onClick={onOpenSignIn}>
            Sign in
          </button>
        )}
      </section>

      <section className="onboarding-coach__link-import">
        <div>
          <span className="onboarding-coach__section-kicker">Quick add</span>
          <h3>Add a person from a LinkedIn URL</h3>
          <p>Paste a profile link into Search. DataNode creates the person, company circle, notes, and saved link.</p>
        </div>
        <button type="button" className="onboarding-coach__primary" onClick={() => onOpenSearch(EXAMPLE_PROFILE_URL)}>
          Try profile link
        </button>
      </section>

      <section className="onboarding-coach__archive">
        <div className="onboarding-coach__archive-header">
          <div>
            <span className="onboarding-coach__section-kicker">Full import</span>
            <h2>How to sync your LinkedIn</h2>
            <p>Request the larger LinkedIn archive, wait for the email, then upload the ZIP here.</p>
          </div>
          <div className="onboarding-coach__archive-actions">
            <button type="button" className="onboarding-coach__primary" onClick={onImportLinkedInZip}>
              Import ZIP
            </button>
            <button type="button" className="onboarding-coach__secondary" onClick={onOpenLinkedInGuide}>
              Open guide
            </button>
          </div>
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
      </section>

      <footer className="onboarding-coach__footer">
        <button type="button" className="onboarding-coach__skip" onClick={onSkip}>
          Not now
        </button>
      </footer>
    </aside>
  )
}
