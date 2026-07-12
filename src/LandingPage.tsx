import type { MouseEvent } from 'react'
import sdnLogo from './assets/sdn-logo.svg'
import productBoardInspector from './assets/landing/product-board-inspector.avif'

const BOARD_ONBOARDING_FORCE_KEY = 'social-board-onboarding-open-v3'

const BOARD_WORKFLOW_STEPS = [
  {
    number: '01',
    title: 'Open your board',
    body: 'Start with the guided board. Place the first person, learn the controls, and give the relationship a visible home.',
  },
  {
    number: '02',
    title: 'Map what matters',
    body: 'Use circles for companies, communities, projects, and the people who can move the next conversation forward.',
  },
  {
    number: '03',
    title: 'Keep context close',
    body: 'Attach the introductions, history, and follow-ups to the person, then find the reason before you need it.',
  },
] as const

const NOTE_CARDS = [
  {
    title: 'A useful introduction',
    body: 'Met through a product conversation. Strong fit for an early customer advisory call.',
    meta: 'Relationship note',
  },
  {
    title: 'Follow up after the round',
    body: 'Interested in the product direction. Reconnect when the next milestone is live.',
    meta: 'Action item',
  },
  {
    title: 'The context you forget',
    body: 'Knows the market, the story, and the person who can make the next introduction.',
    meta: 'Working memory',
  },
] as const

const SEARCH_EXAMPLES = [
  'People I met before fundraising',
  'Product leaders at Google',
  'Recruiters I spoke with about product roles',
] as const

const SEARCH_MATCHES = [
  {
    initials: 'FC',
    title: 'Founder conversation',
    body: 'A note and circle membership point back to a conversation before fundraising.',
    tag: 'Notes + circle',
  },
  {
    initials: 'PL',
    title: 'Product leadership context',
    body: 'A company circle and linked follow-up make the relevant connection easy to surface.',
    tag: 'Company + link',
  },
  {
    initials: 'RT',
    title: 'Recruiting thread',
    body: 'Relationship history keeps the right role and previous conversation together.',
    tag: 'History + note',
  },
] as const

const AGENT_CAPABILITIES = [
  ['MCP', 'Let compatible AI tools read and update the same graph.'],
  ['CLI', 'Query relationship context from the terminal.'],
  ['API', 'Build workflow on a revision-checked graph.'],
] as const

interface LandingPageProps {
  onLogin: () => void
  onSignUp: () => void
  isAuthenticated: boolean
}

export default function LandingPage({ onLogin, onSignUp, isAuthenticated }: LandingPageProps) {
  const handleHome = (event: MouseEvent) => {
    event.preventDefault()
    window.location.hash = ''
  }

  const handleLaunchBoard = (event: MouseEvent) => {
    event.preventDefault()
    try {
      window.sessionStorage.setItem(BOARD_ONBOARDING_FORCE_KEY, '1')
    } catch {
      // Navigation still provides the standard board entry point when storage is unavailable.
    }
    window.location.hash = '#board'
  }

  const handleDocs = (event: MouseEvent) => {
    event.preventDefault()
    window.location.hash = '#docs'
  }

  const handleContact = (event: MouseEvent) => {
    event.preventDefault()
    window.location.hash = '#contact'
  }

  return (
    <div className="landing-container">
      <header className="landing-header">
        <nav className="landing-nav" aria-label="Main navigation">
          <a href="#" className="landing-logo" onClick={handleHome}>
            <img className="landing-logo-mark" src={sdnLogo} alt="" aria-hidden="true" />
            <span className="landing-logo-text">Social Datanode</span>
          </a>

          <div className="landing-nav-right">
            <div className="landing-nav-links">
              <a href="#docs" className="landing-nav-link" onClick={handleDocs}>
                Docs
              </a>
              <a href="#contact" className="landing-nav-link" onClick={handleContact}>
                Contact
              </a>
            </div>

            <div className="landing-nav-actions">
              {isAuthenticated ? (
                <button className="lp-btn lp-btn-filled" onClick={handleLaunchBoard}>
                  Launch app
                </button>
              ) : (
                <>
                  <button className="lp-btn lp-btn-text" onClick={onLogin}>
                    Log in
                  </button>
                  <button className="lp-btn lp-btn-filled" onClick={onSignUp}>
                    Sign up
                  </button>
                </>
              )}
            </div>
          </div>
        </nav>
      </header>

      <main className="landing-main">
        <section className="founder-hero" aria-labelledby="landing-title">
          <div className="founder-hero__layout">
            <div className="founder-hero__copy">
              <h1 id="landing-title" className="founder-hero__title">
                Your network is full of answers. <span>Stop losing them.</span>
              </h1>
              <p className="founder-hero__lead">
                Social Datanode turns people, notes, and follow-ups into a working relationship graph—so you know who to call before the next move.
              </p>
              <div className="founder-hero__actions">
                <button type="button" className="lp-btn lp-btn-filled founder-hero__primary" onClick={handleLaunchBoard}>
                  Open your board
                </button>
              </div>
              <p className="founder-hero__reassurance">A short guide gets your first board moving.</p>
            </div>

            <figure className="founder-product-frame">
              <img
                src={productBoardInspector}
                alt="Social Datanode board with people grouped by company and the person inspector open"
                className="founder-product-frame__image"
              />
            </figure>
          </div>
        </section>

        <section className="founder-section founder-section--archive" aria-labelledby="archive-title">
          <div className="founder-section__inner">
            <div className="founder-section__header founder-section__header--split">
              <div>
                <h2 id="archive-title" className="founder-section__title">Build a relationship map you can use from day one.</h2>
              </div>
              <p className="founder-section__lead">
                Start with the board, not a data dump. The guide gets you moving; people, circles, notes, and links make every next conversation easier to act on.
              </p>
            </div>

            <div className="archive-flow" aria-label="Board-first relationship workflow">
              {BOARD_WORKFLOW_STEPS.map((step) => (
                <button key={step.number} type="button" className="archive-step" onClick={handleLaunchBoard}>
                  <span className="archive-step__number">{step.number}</span>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </button>
              ))}
            </div>

            <p className="archive-detail">Later, signed-in boards can import a LinkedIn ZIP from Settings. The ZIP and raw messages, invitations, and posts are not stored in the graph; only people, connections, and derived context remain.</p>
          </div>
        </section>

        <section className="founder-section" aria-labelledby="search-title">
          <div className="founder-section__inner founder-search-layout">
            <div className="founder-search-copy">
              <h2 id="search-title" className="founder-section__title">Search the reason, not just the name.</h2>
              <p className="founder-section__lead">
                Smart Search reads the names, circles, and notes in your graph to bring the right relationship back into view. Each result can explain the context that made it relevant.
              </p>
              <div className="founder-query-list" aria-label="Smart Search examples">
                {SEARCH_EXAMPLES.map((query) => (
                  <span key={query} className="founder-query-list__item">“{query}”</span>
                ))}
              </div>
              <p className="founder-search-copy__note">Smart Search is available for signed-in boards.</p>
            </div>

            <div className="founder-search-proof" aria-label="Illustration of an explainable search result">
              <div className="founder-search-proof__input">
                <span aria-hidden="true">⌕</span>
                <span>People I met before fundraising</span>
              </div>
              <div className="founder-search-proof__results">
                {SEARCH_MATCHES.map((match) => (
                  <div key={match.title} className="founder-search-proof__result">
                    <div className="founder-search-proof__avatar" aria-hidden="true">{match.initials}</div>
                    <div>
                      <strong>{match.title}</strong>
                      <p>{match.body}</p>
                    </div>
                    <span className="founder-search-proof__reason">{match.tag}</span>
                  </div>
                ))}
              </div>
              <p className="founder-search-proof__caption">The board stays useful after the import—not just beautiful on day one.</p>
            </div>
          </div>
        </section>

        <section className="founder-section founder-section--notes" aria-labelledby="notes-title">
          <div className="founder-section__inner founder-notes-layout">
            <div className="founder-notes-copy">
              <h2 id="notes-title" className="founder-section__title">The details that change your next conversation belong with the person.</h2>
              <p className="founder-section__lead">
                Attach notes, links, action items, and the shape of the relationship to the same visual graph. Context does not disappear into a CRM field or a forgotten chat.
              </p>
            </div>
            <div className="founder-notes-deck" aria-label="Examples of relationship context notes">
              {NOTE_CARDS.map((note, index) => (
                <article key={note.title} className={`founder-note-card founder-note-card--${index + 1}`}>
                  <span className="founder-note-card__meta">{note.meta}</span>
                  <h3>{note.title}</h3>
                  <p>{note.body}</p>
                  <span className="founder-note-card__footer">Attached to the relationship</span>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="founder-section founder-section--agents" aria-labelledby="agents-title">
          <div className="founder-section__inner founder-agent-layout">
            <div className="founder-agent-copy">
              <h2 id="agents-title" className="founder-section__title">Give your agents the context you actually own.</h2>
              <p className="founder-section__lead">
                Social Datanode is not another isolated prompt. Use MCP, the CLI, or the API to let your tools read and work with the relationship graph behind your decisions.
              </p>
              <button type="button" className="lp-btn lp-btn-outlined" onClick={handleDocs}>Explore agent access</button>
            </div>

            <div className="founder-agent-console" aria-label="Agent access capabilities">
              <div className="founder-agent-console__bar">
                <span>social-datanode</span>
                <span>agent access</span>
              </div>
              <div className="founder-agent-console__body">
                <p className="founder-agent-console__command"><span>$</span> ask for the people behind the next move</p>
                <div className="founder-agent-console__capabilities">
                  {AGENT_CAPABILITIES.map(([label, body]) => (
                    <div key={label}>
                      <strong>{label}</strong>
                      <p>{body}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="founder-closing" aria-labelledby="closing-title">
          <h2 id="closing-title">Ready to get the context out of your head?</h2>
          <p>Open your board and make the next conversation easier to act on.</p>
          <div className="founder-closing__actions">
            <button type="button" className="lp-btn lp-btn-filled founder-closing__primary" onClick={handleLaunchBoard}>Open your board</button>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="footer-content">
          <a href="#" className="footer-logo" onClick={handleHome}>
            <img className="footer-logo-mark" src={sdnLogo} alt="" aria-hidden="true" />
            <span className="footer-logo-text">Social Datanode</span>
          </a>
          <span className="footer-copyright">&copy; {new Date().getFullYear()} Social Datanode. All rights reserved.</span>
        </div>
      </footer>
    </div>
  )
}
